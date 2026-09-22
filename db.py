import os
import sqlite3
import threading
from datetime import datetime, date, timedelta


# =========================================================
# 3MIGO COIN V2
# DATABASE CONFIGURATION
# =========================================================

DB_PATH = os.getenv("DB_PATH", "3migo.db")

# Mining settings
MINING_CYCLE_HOURS = int(
    os.getenv("MINING_CYCLE_HOURS", "12")
)

MINING_REWARD = float(
    os.getenv("MINING_REWARD", "10")
)

DAILY_REWARD = 50.0

REFERRAL_REWARD = 25.0


# =========================================================
# DATABASE LOCK
# =========================================================

_db_lock = threading.RLock()


# =========================================================
# TIME HELPERS
# =========================================================

def utc_now():
    return datetime.utcnow()


def utc_now_iso():
    return utc_now().isoformat()


# =========================================================
# DATABASE CONNECTION
# =========================================================

def get_conn():
    connection = sqlite3.connect(
        DB_PATH,
        timeout=30,
        check_same_thread=False
    )

    connection.row_factory = sqlite3.Row

    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout=30000")
    connection.execute("PRAGMA foreign_keys=ON")

    return connection


# Backward compatibility
def conn():
    return get_conn()


# =========================================================
# DATABASE INITIALIZATION
# =========================================================

def init_db():
    with _db_lock:
        connection = get_conn()

        try:
            # -------------------------------------------------
            # USERS
            # -------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    telegram_id INTEGER PRIMARY KEY,
                    username TEXT DEFAULT '',
                    referral_code TEXT UNIQUE,
                    referred_by TEXT DEFAULT '',
                    balance_3m REAL DEFAULT 0,
                    last_daily TEXT DEFAULT ''
                )
            """)

            # -------------------------------------------------
            # TRANSACTIONS
            # -------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    amount REAL NOT NULL,
                    transaction_type TEXT NOT NULL,
                    reference TEXT DEFAULT '',
                    created_at TEXT NOT NULL
                )
            """)

            # -------------------------------------------------
            # MINING SESSIONS
            # -------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS mining_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    started_at TEXT NOT NULL,
                    ends_at TEXT NOT NULL,
                    claimed_at TEXT DEFAULT '',
                    reward REAL NOT NULL DEFAULT 10,
                    status TEXT NOT NULL DEFAULT 'active'
                )
            """)

            # -------------------------------------------------
            # TASKS
            # -------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    reward_3m REAL NOT NULL DEFAULT 0,
                    task_type TEXT DEFAULT 'general',
                    task_url TEXT DEFAULT '',
                    active INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL
                )
            """)

            # -------------------------------------------------
            # USER TASKS
            # -------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS user_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    task_id INTEGER NOT NULL,
                    completed_at TEXT NOT NULL,
                    UNIQUE(telegram_id, task_id)
                )
            """)

            connection.commit()

        finally:
            connection.close()


# =========================================================
# REFERRAL CODE
# =========================================================

def make_referral_code(telegram_id):
    return f"3M{telegram_id}"


# =========================================================
# CREATE USER
# =========================================================

def create_user(
    telegram_id,
    username="",
    referred_by=""
):
    with _db_lock:
        connection = get_conn()

        try:
            user = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (telegram_id,)
            ).fetchone()

            if user:
                return user, False

            referral_code = make_referral_code(
                telegram_id
            )

            duplicate = connection.execute(
                """
                SELECT 1
                FROM users
                WHERE referral_code=?
                """,
                (referral_code,)
            ).fetchone()

            if duplicate:
                referral_code = (
                    f"3M{telegram_id}_"
                    f"{int(utc_now().timestamp())}"
                )

            connection.execute(
                """
                INSERT INTO users (
                    telegram_id,
                    username,
                    referral_code,
                    referred_by,
                    balance_3m,
                    last_daily
                )
                VALUES (?, ?, ?, ?, 0, '')
                """,
                (
                    telegram_id,
                    username or "",
                    referral_code,
                    referred_by or ""
                )
            )

            connection.commit()

            user = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (telegram_id,)
            ).fetchone()

            return user, True

        finally:
            connection.close()


# =========================================================
# GET USER
# =========================================================

def get_user(telegram_id):
    with _db_lock:
        connection = get_conn()

        try:
            user = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (telegram_id,)
            ).fetchone()

            if user:
                return user

        finally:
            connection.close()

    # Create user if not found
    return create_user(telegram_id)[0]


# =========================================================
# CREDIT USER
# =========================================================

def credit(
    telegram_id,
    amount,
    transaction_type,
    reference=""
):
    with _db_lock:
        connection = get_conn()

        try:
            user = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (telegram_id,)
            ).fetchone()

            if user is None:
                connection.execute(
                    """
                    INSERT INTO users (
                        telegram_id,
                        username,
                        referral_code,
                        referred_by,
                        balance_3m,
                        last_daily
                    )
                    VALUES (?, '', ?, '', 0, '')
                    """,
                    (
                        telegram_id,
                        make_referral_code(
                            telegram_id
                        )
                    )
                )

            cursor = connection.execute(
                """
                UPDATE users
                SET balance_3m = balance_3m + ?
                WHERE telegram_id=?
                """,
                (
                    amount,
                    telegram_id
                )
            )

            if cursor.rowcount == 0:
                connection.rollback()
                return None

            connection.execute(
                """
                INSERT INTO transactions (
                    telegram_id,
                    amount,
                    transaction_type,
                    reference,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    telegram_id,
                    amount,
                    transaction_type,
                    reference,
                    utc_now_iso()
                )
            )

            connection.commit()

            return connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (telegram_id,)
            ).fetchone()

        finally:
            connection.close()


# =========================================================
# DAILY REWARD
# =========================================================

def claim_daily(telegram_id):
    with _db_lock:
        connection = get_conn()

        try:
            user = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (telegram_id,)
            ).fetchone()

            if user is None:
                connection.execute(
                    """
                    INSERT INTO users (
                        telegram_id,
                        username,
                        referral_code,
                        referred_by,
                        balance_3m,
                        last_daily
                    )
                    VALUES (?, '', ?, '', 0, '')
                    """,
                    (
                        telegram_id,
                        make_referral_code(
                            telegram_id
                        )
                    )
                )

                connection.commit()

                user = connection.execute(
                    """
                    SELECT *
                    FROM users
                    WHERE telegram_id=?
                    """,
                    (telegram_id,)
                ).fetchone()

            today = date.today().isoformat()

            if user["last_daily"] == today:
                return user, "already_claimed"

            cursor = connection.execute(
                """
                UPDATE users
                SET last_daily=?,
                    balance_3m =
                        balance_3m + ?
                WHERE telegram_id=?
                """,
                (
                    today,
                    DAILY_REWARD,
                    telegram_id
                )
            )

            if cursor.rowcount == 0:
                connection.rollback()
                return user, "error"

            connection.execute(
                """
                INSERT INTO transactions (
                    telegram_id,
                    amount,
                    transaction_type,
                    reference,
                    created_at
                )
                VALUES (?, ?, 'daily_reward', 'daily', ?)
                """,
                (
                    telegram_id,
                    DAILY_REWARD,
                    utc_now_iso()
                )
            )

            connection.commit()

            user = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (telegram_id,)
            ).fetchone()

            return user, "claimed"

        finally:
            connection.close()


# =========================================================
# MINING
# =========================================================

def get_mining_session(telegram_id):
    with _db_lock:
        connection = get_conn()

        try:
            return connection.execute(
                """
                SELECT *
                FROM mining_sessions
                WHERE telegram_id=?
                ORDER BY id DESC
                LIMIT 1
                """,
                (telegram_id,)
            ).fetchone()

        finally:
            connection.close()


def start_mining(telegram_id):
    """
    Start a new mining cycle.

    Default:
        12 hours
        10 3M reward
    """

    with _db_lock:
        connection = get_conn()

        try:
            user = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (telegram_id,)
            ).fetchone()

            if user is None:
                return None, "user_not_found"

            active = connection.execute(
                """
                SELECT *
                FROM mining_sessions
                WHERE telegram_id=?
                AND status='active'
                ORDER BY id DESC
                LIMIT 1
                """,
                (telegram_id,)
            ).fetchone()

            now = utc_now()

            if active:
                ends_at = datetime.fromisoformat(
                    active["ends_at"]
                )

                if now < ends_at:
                    return active, "already_mining"

                return active, "ready_to_claim"

            started_at = now
            ends_at = (
                now +
                timedelta(
                    hours=MINING_CYCLE_HOURS
                )
            )

            cursor = connection.execute(
                """
                INSERT INTO mining_sessions (
                    telegram_id,
                    started_at,
                    ends_at,
                    claimed_at,
                    reward,
                    status
                )
                VALUES (?, ?, ?, '', ?, 'active')
                """,
                (
                    telegram_id,
                    started_at.isoformat(),
                    ends_at.isoformat(),
                    MINING_REWARD
                )
            )

            connection.commit()

            session = connection.execute(
                """
                SELECT *
                FROM mining_sessions
                WHERE id=?
                """,
                (cursor.lastrowid,)
            ).fetchone()

            return session, "started"

        finally:
            connection.close()


def claim_mining(telegram_id):
    """
    Claim mining reward after cycle completion.
    """

    with _db_lock:
        connection = get_conn()

        try:
            session = connection.execute(
                """
                SELECT *
                FROM mining_sessions
                WHERE telegram_id=?
                AND status='active'
                ORDER BY id DESC
                LIMIT 1
                """,
                (telegram_id,)
            ).fetchone()

            if session is None:
                return None, "no_active_mining"

            now = utc_now()

            ends_at = datetime.fromisoformat(
                session["ends_at"]
            )

            if now < ends_at:
                return session, "not_ready"

            reward = float(
                session["reward"]
            )

            cursor = connection.execute(
                """
                UPDATE mining_sessions
                SET status='claimed',
                    claimed_at=?
                WHERE id=?
                AND status='active'
                """,
                (
                    now.isoformat(),
                    session["id"]
                )
            )

            if cursor.rowcount == 0:
                connection.rollback()
                return session, "already_claimed"

            cursor = connection.execute(
                """
                UPDATE users
                SET balance_3m =
                    balance_3m + ?
                WHERE telegram_id=?
                """,
                (
                    reward,
                    telegram_id
                )
            )

            if cursor.rowcount == 0:
                connection.rollback()
                return None, "user_not_found"

            connection.execute(
                """
                INSERT INTO transactions (
                    telegram_id,
                    amount,
                    transaction_type,
                    reference,
                    created_at
                )
                VALUES (?, ?, 'mining_reward', ?, ?)
                """,
                (
                    telegram_id,
                    reward,
                    f"mining:{session['id']}",
                    now.isoformat()
                )
            )

            connection.commit()

            user = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (telegram_id,)
            ).fetchone()

            return user, "claimed"

        finally:
            connection.close()


def mining_status(telegram_id):
    """
    Return current mining status.
    """

    with _db_lock:
        connection = get_conn()

        try:
            session = connection.execute(
                """
                SELECT *
                FROM mining_sessions
                WHERE telegram_id=?
                ORDER BY id DESC
                LIMIT 1
                """,
                (telegram_id,)
            ).fetchone()

            if session is None:
                return {
                    "status": "ready",
                    "cycle_hours":
                        MINING_CYCLE_HOURS,
                    "reward":
                        MINING_REWARD
                }

            now = utc_now()

            if session["status"] == "active":

                ends_at = datetime.fromisoformat(
                    session["ends_at"]
                )

                if now >= ends_at:
                    return {
                        "status":
                            "ready_to_claim",
                        "session_id":
                            session["id"],
                        "started_at":
                            session["started_at"],
                        "ends_at":
                            session["ends_at"],
                        "reward":
                            float(
                                session["reward"]
                            ),
                        "cycle_hours":
                            MINING_CYCLE_HOURS
                    }

                remaining = max(
                    0,
                    int(
                        (
                            ends_at - now
                        ).total_seconds()
                    )
                )

                return {
                    "status": "mining",
                    "session_id":
                        session["id"],
                    "started_at":
                        session["started_at"],
                    "ends_at":
                        session["ends_at"],
                    "remaining_seconds":
                        remaining,
                    "reward":
                        float(
                            session["reward"]
                        ),
                    "cycle_hours":
                        MINING_CYCLE_HOURS
                }

            return {
                "status": "ready",
                "last_session_id":
                    session["id"],
                "reward":
                    MINING_REWARD,
                "cycle_hours":
                    MINING_CYCLE_HOURS
            }

        finally:
            connection.close()


# =========================================================
# TRANSACTIONS
# =========================================================

def transactions(telegram_id):
    with _db_lock:
        connection = get_conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM transactions
                WHERE telegram_id=?
                ORDER BY id ASC
                """,
                (telegram_id,)
            ).fetchall()

            return [
                dict(row)
                for row in rows
            ]

        finally:
            connection.close()


# =========================================================
# REFERRAL SYSTEM
# =========================================================

def apply_referral(
    new_user_id,
    referral_code
):
    if not referral_code:
        return None, "no_referral"

    with _db_lock:
        connection = get_conn()

        try:
            new_user = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (new_user_id,)
            ).fetchone()

            if new_user is None:
                return None, "new_user_not_found"

            if new_user["referred_by"]:
                return new_user, "already_referred"

            referrer = connection.execute(
                """
                SELECT *
                FROM users
                WHERE referral_code=?
                """,
                (referral_code,)
            ).fetchone()

            if referrer is None:
                return new_user, "invalid_referral"

            if (
                referrer["telegram_id"]
                == new_user_id
            ):
                return new_user, "self_referral"

            connection.execute(
                """
                UPDATE users
                SET referred_by=?
                WHERE telegram_id=?
                """,
                (
                    referral_code,
                    new_user_id
                )
            )

            connection.execute(
                """
                UPDATE users
                SET balance_3m =
                    balance_3m + ?
                WHERE telegram_id=?
                """,
                (
                    REFERRAL_REWARD,
                    referrer["telegram_id"]
                )
            )

            connection.execute(
                """
                INSERT INTO transactions (
                    telegram_id,
                    amount,
                    transaction_type,
                    reference,
                    created_at
                )
                VALUES (?, ?, 'referral_reward', ?, ?)
                """,
                (
                    referrer["telegram_id"],
                    REFERRAL_REWARD,
                    f"referral:{new_user_id}",
                    utc_now_iso()
                )
            )

            connection.commit()

            updated_referrer = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (
                    referrer["telegram_id"],
                )
            ).fetchone()

            return (
                updated_referrer,
                "referral_applied"
            )

        finally:
            connection.close()


# =========================================================
# TASK SYSTEM
# =========================================================

def init_tasks():
    with _db_lock:
        connection = get_conn()

        try:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    reward_3m REAL NOT NULL DEFAULT 0,
                    task_type TEXT DEFAULT 'general',
                    task_url TEXT DEFAULT '',
                    active INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL
                )
            """)

            connection.execute("""
                CREATE TABLE IF NOT EXISTS user_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    task_id INTEGER NOT NULL,
                    completed_at TEXT NOT NULL,
                    UNIQUE(telegram_id, task_id)
                )
            """)

            count = connection.execute(
                """
                SELECT COUNT(*) AS count
                FROM tasks
                """
            ).fetchone()["count"]

            if count == 0:
                tasks = [
                    (
                        "📱 استخدام تطبيق 3Migo",
                        "افتح تطبيق 3Migo واستخدم الواجهة",
                        10,
                        "visit",
                        "/"
                    ),
                    (
                        "📢 متابعة أخبار 3Migo",
                        "تابع قناة 3Migo الرسمية",
                        25,
                        "channel",
                        ""
                    ),
                    (
                        "👥 دعوة مستخدم جديد",
                        "ادعُ مستخدمًا جديدًا إلى 3Migo",
                        25,
                        "referral",
                        ""
                    )
                ]

                for task in tasks:
                    connection.execute(
                        """
                        INSERT INTO tasks (
                            title,
                            description,
                            reward_3m,
                            task_type,
                            task_url,
                            active,
                            created_at
                        )
                        VALUES (?, ?, ?, ?, ?, 1, ?)
                        """,
                        (
                            task[0],
                            task[1],
                            task[2],
                            task[3],
                            task[4],
                            utc_now_iso()
                        )
                    )

            connection.commit()

        finally:
            connection.close()


def get_tasks(telegram_id):
    with _db_lock:
        connection = get_conn()

        try:
            rows = connection.execute(
                """
                SELECT
                    t.id,
                    t.title,
                    t.description,
                    t.reward_3m,
                    t.task_type,
                    t.task_url,
                    CASE
                        WHEN ut.id IS NULL THEN 0
                        ELSE 1
                    END AS completed
                FROM tasks t
                LEFT JOIN user_tasks ut
                    ON ut.task_id = t.id
                    AND ut.telegram_id = ?
                WHERE t.active = 1
                ORDER BY t.id ASC
                """,
                (telegram_id,)
            ).fetchall()

            return [
                dict(row)
                for row in rows
            ]

        finally:
            connection.close()


def complete_task(
    telegram_id,
    task_id
):
    with _db_lock:
        connection = get_conn()

        try:
            user = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (telegram_id,)
            ).fetchone()

            if user is None:
                return None, "user_not_found"

            task = connection.execute(
                """
                SELECT *
                FROM tasks
                WHERE id=?
                AND active=1
                """,
                (task_id,)
            ).fetchone()

            if task is None:
                return None, "task_not_found"

            completed = connection.execute(
                """
                SELECT id
                FROM user_tasks
                WHERE telegram_id=?
                AND task_id=?
                """,
                (
                    telegram_id,
                    task_id
                )
            ).fetchone()

            if completed:
                return user, "already_completed"

            reward = float(
                task["reward_3m"]
            )

            connection.execute(
                """
                INSERT INTO user_tasks (
                    telegram_id,
                    task_id,
                    completed_at
                )
                VALUES (?, ?, ?)
                """,
                (
                    telegram_id,
                    task_id,
                    utc_now_iso()
                )
            )

            connection.execute(
                """
                UPDATE users
                SET balance_3m =
                    balance_3m + ?
                WHERE telegram_id=?
                """,
                (
                    reward,
                    telegram_id
                )
            )

            connection.execute(
                """
                INSERT INTO transactions (
                    telegram_id,
                    amount,
                    transaction_type,
                    reference,
                    created_at
                )
                VALUES (?, ?, 'task_reward', ?, ?)
                """,
                (
                    telegram_id,
                    reward,
                    f"task:{task_id}",
                    utc_now_iso()
                )
            )

            connection.commit()

            updated_user = connection.execute(
                """
                SELECT *
                FROM users
                WHERE telegram_id=?
                """,
                (telegram_id,)
            ).fetchone()

            return updated_user, "completed"

        finally:
            connection.close()


# =========================================================
# ADMIN STATS
# =========================================================

def stats():
    with _db_lock:
        connection = get_conn()

        try:
            users = connection.execute(
                """
                SELECT COUNT(*) AS count
                FROM users
                """
            ).fetchone()["count"]

            balance = connection.execute(
                """
                SELECT COALESCE(
                    SUM(balance_3m),
                    0
                ) AS total
                FROM users
                """
            ).fetchone()["total"]

            return {
                "users": users,
                "total_balance_3m": balance
            }

        finally:
            connection.close()


# =========================================================
# REVENUE SYSTEM
# =========================================================

def add_revenue(
    source,
    campaign_id,
    gross_amount,
    currency,
    notes,
    status
):
    with _db_lock:
        connection = get_conn()

        try:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS revenue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    campaign_id TEXT DEFAULT '',
                    gross_amount REAL NOT NULL,
                    currency TEXT DEFAULT 'USD',
                    notes TEXT DEFAULT '',
                    status TEXT DEFAULT 'confirmed',
                    created_at TEXT NOT NULL
                )
            """)

            cursor = connection.execute(
                """
                INSERT INTO revenue (
                    source,
                    campaign_id,
                    gross_amount,
                    currency,
                    notes,
                    status,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    source,
                    campaign_id,
                    gross_amount,
                    currency,
                    notes,
                    status,
                    utc_now_iso()
                )
            )

            connection.commit()

            return cursor.lastrowid

        finally:
            connection.close()


def all_revenue():
    with _db_lock:
        connection = get_conn()

        try:
            table = connection.execute(
                """
                SELECT name
                FROM sqlite_master
                WHERE type='table'
                AND name='revenue'
                """
            ).fetchone()

            if not table:
                return []

            rows = connection.execute(
                """
                SELECT *
                FROM revenue
                ORDER BY id DESC
                """
            ).fetchall()

            return [
                dict(row)
                for row in rows
            ]

        finally:
            connection.close()


def allocate_revenue(
    revenue_id,
    reward_pool_share
):
    """
    Placeholder for the future revenue
    allocation engine.
    """

    return {
        "revenue_id": revenue_id,
        "reward_pool_share":
            reward_pool_share
    }
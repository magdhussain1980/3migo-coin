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
# 3MIGO REVENUE ENGINE V3
# =========================================================

# Default revenue allocation
# These percentages are planning parameters and can be
# changed later from the administration system.

REWARD_POOL_SHARE = float(
    os.getenv("REWARD_POOL_SHARE", "40")
)

TREASURY_SHARE = float(
    os.getenv("TREASURY_SHARE", "30")
)

OPERATIONS_SHARE = float(
    os.getenv("OPERATIONS_SHARE", "20")
)

MARKETING_SHARE = float(
    os.getenv("MARKETING_SHARE", "10")
)


def init_revenue():
    """
    Initialize the revenue engine database.

    Revenue represents real advertising or commercial
    income received by the 3Migo platform.
    """

    with _db_lock:
        connection = get_conn()

        try:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS revenue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    source TEXT NOT NULL,

                    campaign_id TEXT DEFAULT '',

                    ad_type TEXT DEFAULT 'general',

                    gross_amount REAL NOT NULL DEFAULT 0,

                    currency TEXT DEFAULT 'USD',

                    notes TEXT DEFAULT '',

                    status TEXT NOT NULL DEFAULT 'pending',

                    reward_pool_amount REAL DEFAULT 0,

                    treasury_amount REAL DEFAULT 0,

                    operations_amount REAL DEFAULT 0,

                    marketing_amount REAL DEFAULT 0,

                    created_at TEXT NOT NULL,

                    confirmed_at TEXT DEFAULT ''
                )
            """)

            connection.execute("""
                CREATE INDEX IF NOT EXISTS
                idx_revenue_status
                ON revenue(status)
            """)

            connection.execute("""
                CREATE INDEX IF NOT EXISTS
                idx_revenue_created
                ON revenue(created_at)
            """)

            connection.commit()

        finally:
            connection.close()


def calculate_revenue_allocation(
    gross_amount
):
    """
    Calculate how a confirmed revenue amount
    will be allocated inside the 3Migo economy.
    """

    amount = float(gross_amount or 0)

    reward_pool = (
        amount * REWARD_POOL_SHARE / 100
    )

    treasury = (
        amount * TREASURY_SHARE / 100
    )

    operations = (
        amount * OPERATIONS_SHARE / 100
    )

    marketing = (
        amount * MARKETING_SHARE / 100
    )

    return {
        "gross_amount": round(amount, 8),

        "reward_pool_amount":
            round(reward_pool, 8),

        "treasury_amount":
            round(treasury, 8),

        "operations_amount":
            round(operations, 8),

        "marketing_amount":
            round(marketing, 8)
    }


def add_revenue(
    source,
    campaign_id="",
    ad_type="general",
    gross_amount=0,
    currency="USD",
    notes="",
    status="pending"
):
    """
    Register a new advertising/commercial revenue record.

    Example:

        add_revenue(
            source="ad_network",
            campaign_id="CAMPAIGN001",
            ad_type="video",
            gross_amount=10,
            currency="USD",
            status="confirmed"
        )
    """

    init_revenue()

    valid_statuses = {
        "pending",
        "confirmed",
        "cancelled"
    }

    if status not in valid_statuses:
        status = "pending"

    allocation = calculate_revenue_allocation(
        gross_amount
    )

    with _db_lock:
        connection = get_conn()

        try:

            confirmed_at = ""

            if status == "confirmed":
                confirmed_at = utc_now_iso()

            cursor = connection.execute(
                """
                INSERT INTO revenue (
                    source,
                    campaign_id,
                    ad_type,
                    gross_amount,
                    currency,
                    notes,
                    status,
                    reward_pool_amount,
                    treasury_amount,
                    operations_amount,
                    marketing_amount,
                    created_at,
                    confirmed_at
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?
                )
                """,
                (
                    source or "unknown",
                    campaign_id or "",
                    ad_type or "general",
                    allocation["gross_amount"],
                    currency or "USD",
                    notes or "",
                    status,

                    allocation[
                        "reward_pool_amount"
                    ],

                    allocation[
                        "treasury_amount"
                    ],

                    allocation[
                        "operations_amount"
                    ],

                    allocation[
                        "marketing_amount"
                    ],

                    utc_now_iso(),

                    confirmed_at
                )
            )

            connection.commit()

            return cursor.lastrowid

        finally:
            connection.close()


def confirm_revenue(
    revenue_id
):
    """
    Confirm a pending revenue record.

    Allocation amounts are already calculated
    when the record is created.
    """

    init_revenue()

    with _db_lock:
        connection = get_conn()

        try:

            revenue = connection.execute(
                """
                SELECT *
                FROM revenue
                WHERE id=?
                """,
                (revenue_id,)
            ).fetchone()

            if revenue is None:
                return None, "not_found"

            if revenue["status"] == "confirmed":
                return dict(revenue), "already_confirmed"

            if revenue["status"] == "cancelled":
                return dict(revenue), "cancelled"

            connection.execute(
                """
                UPDATE revenue
                SET status='confirmed',
                    confirmed_at=?
                WHERE id=?
                """,
                (
                    utc_now_iso(),
                    revenue_id
                )
            )

            connection.commit()

            updated = connection.execute(
                """
                SELECT *
                FROM revenue
                WHERE id=?
                """,
                (revenue_id,)
            ).fetchone()

            return dict(updated), "confirmed"

        finally:
            connection.close()


def cancel_revenue(
    revenue_id
):
    """
    Cancel a revenue record.
    """

    init_revenue()

    with _db_lock:
        connection = get_conn()

        try:

            revenue = connection.execute(
                """
                SELECT *
                FROM revenue
                WHERE id=?
                """,
                (revenue_id,)
            ).fetchone()

            if revenue is None:
                return None, "not_found"

            if revenue["status"] == "confirmed":
                return dict(revenue), "already_confirmed"

            connection.execute(
                """
                UPDATE revenue
                SET status='cancelled'
                WHERE id=?
                """,
                (revenue_id,)
            )

            connection.commit()

            updated = connection.execute(
                """
                SELECT *
                FROM revenue
                WHERE id=?
                """,
                (revenue_id,)
            ).fetchone()

            return dict(updated), "cancelled"

        finally:
            connection.close()


def all_revenue():
    """
    Return all revenue records.
    """

    init_revenue()

    with _db_lock:
        connection = get_conn()

        try:

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


def revenue_summary():
    """
    Return the complete financial summary
    of the 3Migo revenue engine.
    """

    init_revenue()

    with _db_lock:
        connection = get_conn()

        try:

            total = connection.execute(
                """
                SELECT
                    COALESCE(
                        SUM(gross_amount),
                        0
                    ) AS total
                FROM revenue
                """
            ).fetchone()["total"]

            confirmed = connection.execute(
                """
                SELECT
                    COALESCE(
                        SUM(gross_amount),
                        0
                    ) AS total
                FROM revenue
                WHERE status='confirmed'
                """
            ).fetchone()["total"]

            pending = connection.execute(
                """
                SELECT
                    COALESCE(
                        SUM(gross_amount),
                        0
                    ) AS total
                FROM revenue
                WHERE status='pending'
                """
            ).fetchone()["total"]

            cancelled = connection.execute(
                """
                SELECT
                    COALESCE(
                        SUM(gross_amount),
                        0
                    ) AS total
                FROM revenue
                WHERE status='cancelled'
                """
            ).fetchone()["total"]

            reward_pool = connection.execute(
                """
                SELECT
                    COALESCE(
                        SUM(reward_pool_amount),
                        0
                    ) AS total
                FROM revenue
                WHERE status='confirmed'
                """
            ).fetchone()["total"]

            treasury = connection.execute(
                """
                SELECT
                    COALESCE(
                        SUM(treasury_amount),
                        0
                    ) AS total
                FROM revenue
                WHERE status='confirmed'
                """
            ).fetchone()["total"]

            operations = connection.execute(
                """
                SELECT
                    COALESCE(
                        SUM(operations_amount),
                        0
                    ) AS total
                FROM revenue
                WHERE status='confirmed'
                """
            ).fetchone()["total"]

            marketing = connection.execute(
                """
                SELECT
                    COALESCE(
                        SUM(marketing_amount),
                        0
                    ) AS total
                FROM revenue
                WHERE status='confirmed'
                """
            ).fetchone()["total"]

            return {
                "total_revenue_usd":
                    round(float(total or 0), 8),

                "confirmed_revenue_usd":
                    round(float(confirmed or 0), 8),

                "pending_revenue_usd":
                    round(float(pending or 0), 8),

                "cancelled_revenue_usd":
                    round(float(cancelled or 0), 8),

                "reward_pool_usd":
                    round(float(reward_pool or 0), 8),

                "treasury_usd":
                    round(float(treasury or 0), 8),

                "operations_usd":
                    round(float(operations or 0), 8),

                "marketing_usd":
                    round(float(marketing or 0), 8),

                "allocation": {
                    "reward_pool_percent":
                        REWARD_POOL_SHARE,

                    "treasury_percent":
                        TREASURY_SHARE,

                    "operations_percent":
                        OPERATIONS_SHARE,

                    "marketing_percent":
                        MARKETING_SHARE
                }
            }

        finally:
            connection.close()


def revenue_today():
    """
    Confirmed revenue generated today.
    """

    init_revenue()

    today = date.today().isoformat()

    with _db_lock:
        connection = get_conn()

        try:

            row = connection.execute(
                """
                SELECT
                    COALESCE(
                        SUM(gross_amount),
                        0
                    ) AS total
                FROM revenue
                WHERE status='confirmed'
                AND DATE(created_at)=?
                """,
                (today,)
            ).fetchone()

            return round(
                float(row["total"] or 0),
                8
            )

        finally:
            connection.close()


def revenue_month():
    """
    Confirmed revenue generated during
    the current month.
    """

    init_revenue()

    month_prefix = (
        date.today().strftime("%Y-%m")
    )

    with _db_lock:
        connection = get_conn()

        try:

            row = connection.execute(
                """
                SELECT
                    COALESCE(
                        SUM(gross_amount),
                        0
                    ) AS total
                FROM revenue
                WHERE status='confirmed'
                AND created_at LIKE ?
                """,
                (
                    month_prefix + "%",
                )
            ).fetchone()

            return round(
                float(row["total"] or 0),
                8
            )

        finally:
            connection.close()


def allocate_revenue(
    revenue_id,
    reward_pool_share=None
):
    """
    Return allocation information for a revenue record.

    This function does NOT distribute 3M yet.

    The actual reward distribution engine will be
    implemented in the next phase after the revenue
    accounting layer is verified.
    """

    init_revenue()

    with _db_lock:
        connection = get_conn()

        try:

            revenue = connection.execute(
                """
                SELECT *
                FROM revenue
                WHERE id=?
                """,
                (revenue_id,)
            ).fetchone()

            if revenue is None:
                return {
                    "status": "not_found"
                }

            result = dict(revenue)

            if reward_pool_share is not None:
                result[
                    "requested_reward_pool_share"
                ] = float(reward_pool_share)

            return result

        finally:
            connection.close()
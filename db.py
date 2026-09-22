import os
import sqlite3
import threading
from datetime import datetime, date

DB_PATH = os.getenv("DB_PATH", "3migo.db")

# SQLite connection/write protection
_db_lock = threading.RLock()


def get_conn():
    conn = sqlite3.connect(
        DB_PATH,
        timeout=30,
        check_same_thread=False
    )

    conn.row_factory = sqlite3.Row

    # Improve concurrent access and reduce "database is locked"
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    conn.execute("PRAGMA foreign_keys=ON")

    return conn


def init_db():
    with _db_lock:
        conn = get_conn()

        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    telegram_id INTEGER PRIMARY KEY,
                    username TEXT DEFAULT '',
                    referral_code TEXT UNIQUE,
                    referred_by TEXT DEFAULT '',
                    balance_3m REAL DEFAULT 0,
                    last_daily TEXT DEFAULT ''
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    amount REAL NOT NULL,
                    transaction_type TEXT NOT NULL,
                    reference TEXT DEFAULT '',
                    created_at TEXT NOT NULL
                )
            """)

            conn.commit()

        finally:
            conn.close()


def make_referral_code(telegram_id):
    return f"3M{telegram_id}"


def create_user(telegram_id, username="", referred_by=""):
    with _db_lock:
        conn = get_conn()

        try:
            cur = conn.execute(
                "SELECT * FROM users WHERE telegram_id=?",
                (telegram_id,)
            )
            user = cur.fetchone()

            if user:
                return user, False

            referral_code = make_referral_code(telegram_id)

            # Avoid duplicate referral codes
            cur = conn.execute(
                "SELECT 1 FROM users WHERE referral_code=?",
                (referral_code,)
            )

            if cur.fetchone():
                referral_code = f"3M{telegram_id}_{int(datetime.now().timestamp())}"

            conn.execute("""
                INSERT INTO users
                (telegram_id, username, referral_code, referred_by, balance_3m, last_daily)
                VALUES (?, ?, ?, ?, 0, '')
            """, (
                telegram_id,
                username or "",
                referral_code,
                referred_by or ""
            ))

            conn.commit()

            cur = conn.execute(
                "SELECT * FROM users WHERE telegram_id=?",
                (telegram_id,)
            )

            return cur.fetchone(), True

        finally:
            conn.close()


def get_user(telegram_id):
    with _db_lock:
        conn = get_conn()

        try:
            cur = conn.execute(
                "SELECT * FROM users WHERE telegram_id=?",
                (telegram_id,)
            )

            user = cur.fetchone()

            if user is None:
                return create_user(telegram_id)[0]

            return user

        finally:
            conn.close()


def credit(telegram_id, amount, transaction_type, reference=""):
    with _db_lock:
        conn = get_conn()

        try:
            # Make sure user exists
            cur = conn.execute(
                "SELECT * FROM users WHERE telegram_id=?",
                (telegram_id,)
            )

            if cur.fetchone() is None:
                conn.execute("""
                    INSERT INTO users
                    (telegram_id, username, referral_code, referred_by, balance_3m, last_daily)
                    VALUES (?, '', ?, '', 0, '')
                """, (
                    telegram_id,
                    make_referral_code(telegram_id)
                ))

            # IMPORTANT:
            # rowcount belongs to the cursor, not sqlite3.Connection.
            cur = conn.execute("""
                UPDATE users
                SET balance_3m = balance_3m + ?
                WHERE telegram_id = ?
            """, (
                amount,
                telegram_id
            ))

            if cur.rowcount == 0:
                conn.rollback()
                return None

            conn.execute("""
                INSERT INTO transactions
                (telegram_id, amount, transaction_type, reference, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (
                telegram_id,
                amount,
                transaction_type,
                reference,
                datetime.utcnow().isoformat()
            ))

            conn.commit()

            cur = conn.execute(
                "SELECT * FROM users WHERE telegram_id=?",
                (telegram_id,)
            )

            return cur.fetchone()

        finally:
            conn.close()


def claim_daily(telegram_id):
    with _db_lock:
        conn = get_conn()

        try:
            cur = conn.execute(
                "SELECT * FROM users WHERE telegram_id=?",
                (telegram_id,)
            )

            user = cur.fetchone()

            if user is None:
                conn.execute("""
                    INSERT INTO users
                    (telegram_id, username, referral_code, referred_by, balance_3m, last_daily)
                    VALUES (?, '', ?, '', 0, '')
                """, (
                    telegram_id,
                    make_referral_code(telegram_id)
                ))

                conn.commit()

                cur = conn.execute(
                    "SELECT * FROM users WHERE telegram_id=?",
                    (telegram_id,)
                )

                user = cur.fetchone()

            today = date.today().isoformat()

            if user["last_daily"] == today:
                return user, "already_claimed"

            cur = conn.execute("""
                UPDATE users
                SET last_daily = ?,
                    balance_3m = balance_3m + 50
                WHERE telegram_id = ?
            """, (
                today,
                telegram_id
            ))

            if cur.rowcount == 0:
                conn.rollback()
                return user, "error"

            conn.execute("""
                INSERT INTO transactions
                (telegram_id, amount, transaction_type, reference, created_at)
                VALUES (?, 50, 'daily_reward', 'daily', ?)
            """, (
                telegram_id,
                datetime.utcnow().isoformat()
            ))

            conn.commit()

            cur = conn.execute(
                "SELECT * FROM users WHERE telegram_id=?",
                (telegram_id,)
            )

            return cur.fetchone(), "claimed"

        finally:
            conn.close()

def apply_referral(new_user_id, referral_code):
    """
    تسجيل إحالة مستخدم جديد ومنح مكافأة للمُحيل.
    تعمل مرة واحدة فقط للمستخدم الجديد.
    """

    if not referral_code:
        return None, "no_referral"

    with _db_lock:
        conn = get_conn()

        try:
            # البحث عن المستخدم الجديد
            cur = conn.execute(
                "SELECT * FROM users WHERE telegram_id=?",
                (new_user_id,)
            )
            new_user = cur.fetchone()

            if new_user is None:
                return None, "new_user_not_found"

            # منع تغيير المُحيل بعد تسجيله
            if new_user["referred_by"]:
                return new_user, "already_referred"

            # البحث عن صاحب كود الإحالة
            cur = conn.execute(
                "SELECT * FROM users WHERE referral_code=?",
                (referral_code,)
            )
            referrer = cur.fetchone()

            if referrer is None:
                return new_user, "invalid_referral"

            # منع إحالة الشخص لنفسه
            if referrer["telegram_id"] == new_user_id:
                return new_user, "self_referral"

            # تسجيل المُحيل
            conn.execute("""
                UPDATE users
                SET referred_by=?
                WHERE telegram_id=?
            """, (
                referral_code,
                new_user_id
            ))

            conn.commit()

            # مكافأة المُحيل: 25 3M
            cur = conn.execute("""
                UPDATE users
                SET balance_3m = balance_3m + 25
                WHERE telegram_id=?
            """, (
                referrer["telegram_id"],
            ))

            if cur.rowcount == 0:
                conn.rollback()
                return new_user, "reward_error"

            # تسجيل عملية المكافأة
            conn.execute("""
                INSERT INTO transactions
                (telegram_id, amount, transaction_type, reference, created_at)
                VALUES (?, 25, 'referral_reward', ?, ?)
            """, (
                referrer["telegram_id"],
                f"referral:{new_user_id}",
                datetime.utcnow().isoformat()
            ))

            conn.commit()

            # إرجاع بيانات المُحيل بعد المكافأة
            cur = conn.execute(
                "SELECT * FROM users WHERE telegram_id=?",
                (referrer["telegram_id"],)
            )
            updated_referrer = cur.fetchone()

            return updated_referrer, "referral_applied"

        finally:
            conn.close()
# =========================================================
# 3MIGO COIN — TASK REWARD SYSTEM
# =========================================================

def init_tasks():
    """
    إنشاء جدول المهام وإضافة المهام الأساسية.
    """

    with _db_lock:
        conn = get_conn()

        try:
            conn.execute("""
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

            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    task_id INTEGER NOT NULL,
                    completed_at TEXT NOT NULL,
                    UNIQUE(telegram_id, task_id)
                )
            """)

            # إضافة المهام الأساسية إذا لم تكن موجودة
            existing = conn.execute(
                "SELECT COUNT(*) AS count FROM tasks"
            ).fetchone()["count"]

            if existing == 0:

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
                    conn.execute("""
                        INSERT INTO tasks
                        (
                            title,
                            description,
                            reward_3m,
                            task_type,
                            task_url,
                            active,
                            created_at
                        )
                        VALUES (?, ?, ?, ?, ?, 1, ?)
                    """, (
                        task[0],
                        task[1],
                        task[2],
                        task[3],
                        task[4],
                        datetime.utcnow().isoformat()
                    ))

            conn.commit()

        finally:
            conn.close()


def get_tasks(telegram_id):
    """
    إرجاع المهام النشطة مع حالة إنجاز المستخدم.
    """

    with _db_lock:
        conn = get_conn()

        try:
            rows = conn.execute("""
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
            """, (
                telegram_id,
            )).fetchall()

            return [dict(row) for row in rows]

        finally:
            conn.close()


def complete_task(telegram_id, task_id):
    """
    إكمال مهمة ومنح المكافأة مرة واحدة فقط.
    """

    with _db_lock:
        conn = get_conn()

        try:

            # التأكد من وجود المستخدم
            user = conn.execute(
                "SELECT * FROM users WHERE telegram_id=?",
                (telegram_id,)
            ).fetchone()

            if user is None:
                return None, "user_not_found"

            # البحث عن المهمة
            task = conn.execute("""
                SELECT *
                FROM tasks
                WHERE id=? AND active=1
            """, (
                task_id,
            )).fetchone()

            if task is None:
                return None, "task_not_found"

            # منع الحصول على المكافأة مرتين
            completed = conn.execute("""
                SELECT id
                FROM user_tasks
                WHERE telegram_id=? AND task_id=?
            """, (
                telegram_id,
                task_id
            )).fetchone()

            if completed:
                return user, "already_completed"

            reward = float(task["reward_3m"])

            # تسجيل المهمة
            conn.execute("""
                INSERT INTO user_tasks
                (
                    telegram_id,
                    task_id,
                    completed_at
                )
                VALUES (?, ?, ?)
            """, (
                telegram_id,
                task_id,
                datetime.utcnow().isoformat()
            ))

            # إضافة المكافأة
            conn.execute("""
                UPDATE users
                SET balance_3m = balance_3m + ?
                WHERE telegram_id=?
            """, (
                reward,
                telegram_id
            ))

            # تسجيل المعاملة
            conn.execute("""
                INSERT INTO transactions
                (
                    telegram_id,
                    amount,
                    transaction_type,
                    reference,
                    created_at
                )
                VALUES (?, ?, 'task_reward', ?, ?)
            """, (
                telegram_id,
                reward,
                f"task:{task_id}",
                datetime.utcnow().isoformat()
            ))

            conn.commit()

            updated_user = conn.execute(
                "SELECT * FROM users WHERE telegram_id=?",
                (telegram_id,)
            ).fetchone()

            return updated_user, "completed"

        finally:
            conn.close()
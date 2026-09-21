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
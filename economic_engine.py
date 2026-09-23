"""
3Migo Economic Engine V2
========================

Purpose:
- Manage the internal economic layer of 3Migo.
- Support the V2 maximum supply of 30,000,000,000 3M.
- Track mining, locked/unlocked balances, airdrop,
  contributions, trust, revenue, treasury and utility transactions.
- Prevent supply and allocation violations.
- Provide idempotent economic operations.
- Remain independent from the legacy db.py balance system
  until final integration is approved.

IMPORTANT:
This is an internal economic/accounting layer.
Blockchain and market trading are NOT active.
"""

import os
import sqlite3
import threading
from datetime import datetime
from typing import Optional, Dict, Any


# =========================================================
# CONFIGURATION
# =========================================================

ECONOMIC_DB_PATH = os.getenv(
    "ECONOMIC_DB_PATH",
    os.getenv("DB_PATH", "3migo.db")
)

ENGINE_VERSION = "2.0"

MAX_SUPPLY = 30_000_000_000.0

MINING_ALLOCATION = 12_000_000_000.0
AIRDROP_ALLOCATION = 3_000_000_000.0
TREASURY_ALLOCATION = 4_500_000_000.0
LIQUIDITY_ALLOCATION = 3_000_000_000.0
ECOSYSTEM_ALLOCATION = 3_000_000_000.0
AI_DEVELOPMENT_ALLOCATION = 3_000_000_000.0
SECURITY_OPERATIONS_ALLOCATION = 1_500_000_000.0


# =========================================================
# REVENUE ALLOCATION
# =========================================================

REWARD_POOL_SHARE = 35.0
TREASURY_RESERVE_SHARE = 20.0
AI_PLATFORM_SHARE = 20.0
DEVELOPMENT_SHARE = 10.0
ECOSYSTEM_SHARE = 10.0
SECURITY_SHARE = 5.0


# =========================================================
# DEFAULT USER VALUES
# =========================================================

DEFAULT_TRUST_SCORE = 100.0
DEFAULT_CONTRIBUTION_SCORE = 0.0


# =========================================================
# DATABASE LOCK
# =========================================================

_db_lock = threading.RLock()


# =========================================================
# DATABASE CONNECTION
# =========================================================

def get_connection():
    conn = sqlite3.connect(
        ECONOMIC_DB_PATH,
        timeout=30,
        check_same_thread=False
    )

    conn.row_factory = sqlite3.Row

    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    conn.execute("PRAGMA foreign_keys=ON")

    return conn


# =========================================================
# TIME
# =========================================================

def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds")


# =========================================================
# TOKENOMICS
# =========================================================

def tokenomics_allocations() -> Dict[str, float]:
    return {
        "mining": MINING_ALLOCATION,
        "airdrop": AIRDROP_ALLOCATION,
        "treasury": TREASURY_ALLOCATION,
        "liquidity": LIQUIDITY_ALLOCATION,
        "ecosystem": ECOSYSTEM_ALLOCATION,
        "ai_development": AI_DEVELOPMENT_ALLOCATION,
        "security_operations": SECURITY_OPERATIONS_ALLOCATION,
    }


def validate_tokenomics() -> Dict[str, Any]:
    allocations = tokenomics_allocations()

    total = sum(allocations.values())
    difference = MAX_SUPPLY - total

    valid = abs(difference) < 0.000001

    percentages = {
        "mining": 40.0,
        "airdrop": 10.0,
        "treasury": 15.0,
        "liquidity": 10.0,
        "ecosystem": 10.0,
        "ai_development": 10.0,
        "security_operations": 5.0,
    }

    percentage_total = sum(percentages.values())

    return {
        "valid": valid and abs(percentage_total - 100.0) < 0.000001,
        "max_supply": MAX_SUPPLY,
        "allocation_total": total,
        "difference": difference,
        "percentage_total": percentage_total,
        "allocations": allocations,
        "percentages": percentages,
    }


# =========================================================
# INITIALIZATION
# =========================================================

def init_economic_engine():
    with _db_lock:
        conn = get_connection()

        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS economic_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    engine_version TEXT NOT NULL,
                    max_supply REAL NOT NULL,
                    total_mined REAL NOT NULL DEFAULT 0,
                    total_locked REAL NOT NULL DEFAULT 0,
                    total_unlocked REAL NOT NULL DEFAULT 0,
                    total_airdrop REAL NOT NULL DEFAULT 0,
                    reward_pool_3m REAL NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS economic_users (
                    telegram_id INTEGER PRIMARY KEY,
                    contribution_score REAL NOT NULL DEFAULT 0,
                    trust_score REAL NOT NULL DEFAULT 100,
                    total_mined REAL NOT NULL DEFAULT 0,
                    locked_3m REAL NOT NULL DEFAULT 0,
                    airdrop_3m REAL NOT NULL DEFAULT 0,
                    unlocked_3m REAL NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS economic_balances (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    amount_3m REAL NOT NULL DEFAULT 0,
                    reference TEXT,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS reward_pool_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    amount_3m REAL NOT NULL,
                    reference TEXT UNIQUE,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS lock_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    amount_3m REAL NOT NULL,
                    reference TEXT UNIQUE,
                    status TEXT NOT NULL DEFAULT 'locked',
                    created_at TEXT NOT NULL,
                    unlocked_at TEXT
                );

                CREATE TABLE IF NOT EXISTS contribution_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    source TEXT NOT NULL,
                    score REAL NOT NULL,
                    reference TEXT UNIQUE,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS airdrop_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    amount_3m REAL NOT NULL,
                    reference TEXT UNIQUE,
                    status TEXT NOT NULL DEFAULT 'allocated',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS treasury_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    amount REAL NOT NULL,
                    currency TEXT NOT NULL DEFAULT 'USD',
                    reference TEXT UNIQUE,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS revenue_ledger_v2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    gross_amount REAL NOT NULL,
                    fees REAL NOT NULL DEFAULT 0,
                    net_amount REAL NOT NULL,
                    currency TEXT NOT NULL DEFAULT 'USD',
                    reference TEXT UNIQUE,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    verified_at TEXT
                );

                CREATE TABLE IF NOT EXISTS utility_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER NOT NULL,
                    service TEXT NOT NULL,
                    amount_3m REAL NOT NULL,
                    reference TEXT UNIQUE,
                    status TEXT NOT NULL DEFAULT 'completed',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS economic_audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action TEXT NOT NULL,
                    telegram_id INTEGER,
                    amount_3m REAL,
                    reference TEXT,
                    details TEXT,
                    created_at TEXT NOT NULL
                );
                """
            )

            current = conn.execute(
                "SELECT id FROM economic_state WHERE id = 1"
            ).fetchone()

            if current is None:
                timestamp = now_iso()

                conn.execute(
                    """
                    INSERT INTO economic_state (
                        id,
                        engine_version,
                        max_supply,
                        created_at,
                        updated_at
                    )
                    VALUES (1, ?, ?, ?, ?)
                    """,
                    (
                        ENGINE_VERSION,
                        MAX_SUPPLY,
                        timestamp,
                        timestamp
                    )
                )

            conn.commit()

        finally:
            conn.close()


# =========================================================
# USER ACCOUNT
# =========================================================

def ensure_user_account(telegram_id: int) -> Dict[str, Any]:
    init_economic_engine()

    with _db_lock:
        conn = get_connection()

        try:
            row = conn.execute(
                """
                SELECT *
                FROM economic_users
                WHERE telegram_id = ?
                """,
                (telegram_id,)
            ).fetchone()

            if row is None:
                timestamp = now_iso()

                conn.execute(
                    """
                    INSERT INTO economic_users (
                        telegram_id,
                        contribution_score,
                        trust_score,
                        total_mined,
                        locked_3m,
                        airdrop_3m,
                        unlocked_3m,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, 0, 0, 0, 0, ?, ?)
                    """,
                    (
                        telegram_id,
                        DEFAULT_CONTRIBUTION_SCORE,
                        DEFAULT_TRUST_SCORE,
                        timestamp,
                        timestamp
                    )
                )

                conn.commit()

                row = conn.execute(
                    """
                    SELECT *
                    FROM economic_users
                    WHERE telegram_id = ?
                    """,
                    (telegram_id,)
                ).fetchone()

            return dict(row)

        finally:
            conn.close()


# =========================================================
# ECONOMIC CAPACITY
# =========================================================

def economic_capacity() -> Dict[str, Any]:
    init_economic_engine()

    with _db_lock:
        conn = get_connection()

        try:
            state = conn.execute(
                """
                SELECT *
                FROM economic_state
                WHERE id = 1
                """
            ).fetchone()

            total_mined = float(state["total_mined"])
            total_locked = float(state["total_locked"])
            total_unlocked = float(state["total_unlocked"])
            total_airdrop = float(state["total_airdrop"])
            reward_pool = float(state["reward_pool_3m"])

            remaining_mining = max(
                0.0,
                MINING_ALLOCATION - total_mined
            )

            remaining_supply = max(
                0.0,
                MAX_SUPPLY - (
                    total_mined
                    + total_airdrop
                    + total_unlocked
                )
            )

            return {
                "max_supply": MAX_SUPPLY,
                "mining_allocation": MINING_ALLOCATION,
                "total_mined": total_mined,
                "remaining_mining": remaining_mining,
                "total_locked": total_locked,
                "total_unlocked": total_unlocked,
                "total_airdrop": total_airdrop,
                "remaining_supply": remaining_supply,
                "reward_pool_3m": reward_pool,
                "principle": (
                    "Rewards must remain within approved "
                    "economic capacity."
                ),
            }

        finally:
            conn.close()


# =========================================================
# CONTRIBUTION
# =========================================================

def add_contribution(
    telegram_id: int,
    score: float,
    source: str = "activity",
    reference: Optional[str] = None
) -> Dict[str, Any]:

    if score <= 0:
        raise ValueError("Contribution score must be positive.")

    ensure_user_account(telegram_id)

    with _db_lock:
        conn = get_connection()

        try:
            timestamp = now_iso()

            conn.execute(
                """
                INSERT INTO contribution_ledger (
                    telegram_id,
                    source,
                    score,
                    reference,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    telegram_id,
                    source,
                    score,
                    reference,
                    timestamp
                )
            )

            conn.execute(
                """
                UPDATE economic_users
                SET contribution_score =
                    contribution_score + ?,
                    updated_at = ?
                WHERE telegram_id = ?
                """,
                (
                    score,
                    timestamp,
                    telegram_id
                )
            )

            conn.execute(
                """
                INSERT INTO economic_audit_log (
                    action,
                    telegram_id,
                    amount_3m,
                    reference,
                    details,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    "contribution_added",
                    telegram_id,
                    0,
                    reference,
                    source,
                    timestamp
                )
            )

            conn.commit()

            return user_economic_profile(telegram_id)

        finally:
            conn.close()


# =========================================================
# TRUST SCORE
# =========================================================

def set_trust_score(
    telegram_id: int,
    trust_score: float
) -> Dict[str, Any]:

    trust_score = max(
        0.0,
        min(100.0, float(trust_score))
    )

    ensure_user_account(telegram_id)

    with _db_lock:
        conn = get_connection()

        try:
            conn.execute(
                """
                UPDATE economic_users
                SET trust_score = ?,
                    updated_at = ?
                WHERE telegram_id = ?
                """,
                (
                    trust_score,
                    now_iso(),
                    telegram_id
                )
            )

            conn.commit()

            return user_economic_profile(telegram_id)

        finally:
            conn.close()


# =========================================================
# MINING REWARD
# =========================================================

def register_mining_reward(
    telegram_id: int,
    amount_3m: float,
    reference: Optional[str] = None
) -> Dict[str, Any]:

    if amount_3m <= 0:
        raise ValueError("Mining reward must be positive.")

    ensure_user_account(telegram_id)

    reference = reference or (
        f"mining:{telegram_id}:{now_iso()}"
    )

    with _db_lock:
        conn = get_connection()

        try:
            # Idempotency protection
            existing = conn.execute(
                """
                SELECT id
                FROM lock_ledger
                WHERE reference = ?
                """,
                (reference,)
            ).fetchone()

            if existing is not None:
                return {
                    "success": True,
                    "duplicate": True,
                    "reference": reference,
                    "message": "Reward already registered."
                }

            state = conn.execute(
                """
                SELECT *
                FROM economic_state
                WHERE id = 1
                """
            ).fetchone()

            current_mined = float(state["total_mined"])

            if current_mined + amount_3m > MINING_ALLOCATION:
                raise ValueError(
                    "Mining allocation exceeded."
                )

            if current_mined + amount_3m > MAX_SUPPLY:
                raise ValueError(
                    "Maximum supply exceeded."
                )

            timestamp = now_iso()

            conn.execute(
                """
                INSERT INTO lock_ledger (
                    telegram_id,
                    amount_3m,
                    reference,
                    status,
                    created_at
                )
                VALUES (?, ?, ?, 'locked', ?)
                """,
                (
                    telegram_id,
                    amount_3m,
                    reference,
                    timestamp
                )
            )

            conn.execute(
                """
                UPDATE economic_users
                SET total_mined = total_mined + ?,
                    locked_3m = locked_3m + ?,
                    updated_at = ?
                WHERE telegram_id = ?
                """,
                (
                    amount_3m,
                    amount_3m,
                    timestamp,
                    telegram_id
                )
            )

            conn.execute(
                """
                UPDATE economic_state
                SET total_mined = total_mined + ?,
                    total_locked = total_locked + ?,
                    updated_at = ?
                WHERE id = 1
                """,
                (
                    amount_3m,
                    amount_3m,
                    timestamp
                )
            )

            conn.execute(
                """
                INSERT INTO economic_audit_log (
                    action,
                    telegram_id,
                    amount_3m,
                    reference,
                    details,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    "mining_reward_locked",
                    telegram_id,
                    amount_3m,
                    reference,
                    "Mining reward registered as locked 3M",
                    timestamp
                )
            )

            conn.commit()

            return {
                "success": True,
                "duplicate": False,
                "telegram_id": telegram_id,
                "reward_3m": amount_3m,
                "status": "locked",
                "reference": reference
            }

        finally:
            conn.close()


# =========================================================
# UNLOCK
# =========================================================

def unlock_3m(
    telegram_id: int,
    amount_3m: float,
    reference: Optional[str] = None
) -> Dict[str, Any]:

    if amount_3m <= 0:
        raise ValueError("Unlock amount must be positive.")

    ensure_user_account(telegram_id)

    reference = reference or (
        f"unlock:{telegram_id}:{now_iso()}"
    )

    with _db_lock:
        conn = get_connection()

        try:
            existing = conn.execute(
                """
                SELECT id
                FROM economic_audit_log
                WHERE action = '3m_unlocked'
                AND reference = ?
                """,
                (reference,)
            ).fetchone()

            if existing is not None:
                return {
                    "success": True,
                    "duplicate": True,
                    "reference": reference
                }

            user = conn.execute(
                """
                SELECT locked_3m
                FROM economic_users
                WHERE telegram_id = ?
                """,
                (telegram_id,)
            ).fetchone()

            if user is None:
                raise ValueError("Economic user not found.")

            locked = float(user["locked_3m"])

            if amount_3m > locked:
                raise ValueError(
                    "Unlock amount exceeds locked balance."
                )

            timestamp = now_iso()

            conn.execute(
                """
                UPDATE economic_users
                SET locked_3m = locked_3m - ?,
                    unlocked_3m = unlocked_3m + ?,
                    updated_at = ?
                WHERE telegram_id = ?
                """,
                (
                    amount_3m,
                    amount_3m,
                    timestamp,
                    telegram_id
                )
            )

            conn.execute(
                """
                UPDATE economic_state
                SET total_locked = total_locked - ?,
                    total_unlocked = total_unlocked + ?,
                    updated_at = ?
                WHERE id = 1
                """,
                (
                    amount_3m,
                    amount_3m,
                    timestamp
                )
            )

            conn.execute(
                """
                INSERT INTO economic_audit_log (
                    action,
                    telegram_id,
                    amount_3m,
                    reference,
                    details,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    "3m_unlocked",
                    telegram_id,
                    amount_3m,
                    reference,
                    "Locked 3M moved to unlocked balance",
                    timestamp
                )
            )

            conn.commit()

            return {
                "success": True,
                "duplicate": False,
                "telegram_id": telegram_id,
                "amount_3m": amount_3m,
                "status": "unlocked"
            }

        finally:
            conn.close()


# =========================================================
# REWARD POOL
# =========================================================

def add_reward_pool_funds(
    amount_3m: float,
    source: str = "revenue",
    reference: Optional[str] = None
) -> Dict[str, Any]:

    if amount_3m <= 0:
        raise ValueError("Reward pool amount must be positive.")

    reference = reference or (
        f"reward_pool:{now_iso()}"
    )

    with _db_lock:
        conn = get_connection()

        try:
            existing = conn.execute(
                """
                SELECT id
                FROM reward_pool_ledger
                WHERE reference = ?
                """,
                (reference,)
            ).fetchone()

            if existing is not None:
                return {
                    "success": True,
                    "duplicate": True,
                    "reference": reference
                }

            timestamp = now_iso()

            conn.execute(
                """
                INSERT INTO reward_pool_ledger (
                    source,
                    amount_3m,
                    reference,
                    created_at
                )
                VALUES (?, ?, ?, ?)
                """,
                (
                    source,
                    amount_3m,
                    reference,
                    timestamp
                )
            )

            conn.execute(
                """
                UPDATE economic_state
                SET reward_pool_3m =
                    reward_pool_3m + ?,
                    updated_at = ?
                WHERE id = 1
                """,
                (
                    amount_3m,
                    timestamp
                )
            )

            conn.commit()

            return {
                "success": True,
                "duplicate": False,
                "amount_3m": amount_3m,
                "source": source,
                "reference": reference
            }

        finally:
            conn.close()


# =========================================================
# TREASURY FUNDS
# =========================================================

def add_treasury_funds(
    amount: float,
    currency: str = "USD",
    source: str = "revenue",
    reference: Optional[str] = None
) -> Dict[str, Any]:

    if amount <= 0:
        raise ValueError("Treasury amount must be positive.")

    reference = reference or (
        f"treasury:{currency}:{now_iso()}"
    )

    with _db_lock:
        conn = get_connection()

        try:
            existing = conn.execute(
                """
                SELECT id
                FROM treasury_ledger
                WHERE reference = ?
                """,
                (reference,)
            ).fetchone()

            if existing is not None:
                return {
                    "success": True,
                    "duplicate": True,
                    "reference": reference
                }

            conn.execute(
                """
                INSERT INTO treasury_ledger (
                    source,
                    amount,
                    currency,
                    reference,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    source,
                    amount,
                    currency,
                    reference,
                    now_iso()
                )
            )

            conn.commit()

            return {
                "success": True,
                "duplicate": False,
                "amount": amount,
                "currency": currency,
                "source": source,
                "reference": reference
            }

        finally:
            conn.close()


# =========================================================
# REVENUE
# =========================================================

def record_revenue(
    source: str,
    gross_amount: float,
    fees: float = 0.0,
    currency: str = "USD",
    reference: Optional[str] = None,
    status: str = "pending"
) -> Dict[str, Any]:

    if gross_amount <= 0:
        raise ValueError("Gross revenue must be positive.")

    if fees < 0:
        raise ValueError("Fees cannot be negative.")

    if fees > gross_amount:
        raise ValueError(
            "Fees cannot exceed gross revenue."
        )

    net_amount = gross_amount - fees

    reference = reference or (
        f"revenue:{source}:{now_iso()}"
    )

    with _db_lock:
        conn = get_connection()

        try:
            existing = conn.execute(
                """
                SELECT *
                FROM revenue_ledger_v2
                WHERE reference = ?
                """,
                (reference,)
            ).fetchone()

            if existing is not None:
                return {
                    "success": True,
                    "duplicate": True,
                    "revenue": dict(existing)
                }

            timestamp = now_iso()

            conn.execute(
                """
                INSERT INTO revenue_ledger_v2 (
                    source,
                    gross_amount,
                    fees,
                    net_amount,
                    currency,
                    reference,
                    status,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    source,
                    gross_amount,
                    fees,
                    net_amount,
                    currency,
                    reference,
                    status,
                    timestamp
                )
            )

            conn.commit()

            return {
                "success": True,
                "duplicate": False,
                "source": source,
                "gross_amount": gross_amount,
                "fees": fees,
                "net_amount": net_amount,
                "currency": currency,
                "reference": reference,
                "status": status
            }

        finally:
            conn.close()


# =========================================================
# CONFIRM REVENUE
# =========================================================

def confirm_revenue(
    reference: str
) -> Dict[str, Any]:

    with _db_lock:
        conn = get_connection()

        try:
            row = conn.execute(
                """
                SELECT *
                FROM revenue_ledger_v2
                WHERE reference = ?
                """,
                (reference,)
            ).fetchone()

            if row is None:
                raise ValueError("Revenue record not found.")

            if row["status"] == "verified":
                return {
                    "success": True,
                    "duplicate": True,
                    "reference": reference
                }

            timestamp = now_iso()

            conn.execute(
                """
                UPDATE revenue_ledger_v2
                SET status = 'verified',
                    verified_at = ?
                WHERE reference = ?
                """,
                (
                    timestamp,
                    reference
                )
            )

            net_amount = float(row["net_amount"])
            currency = row["currency"]

            # Revenue allocation is accounting-level.
            # It does not automatically mint 3M.
            reward_amount = (
                net_amount * REWARD_POOL_SHARE / 100.0
            )

            treasury_amount = (
                net_amount * TREASURY_RESERVE_SHARE / 100.0
            )

            ai_amount = (
                net_amount * AI_PLATFORM_SHARE / 100.0
            )

            development_amount = (
                net_amount * DEVELOPMENT_SHARE / 100.0
            )

            ecosystem_amount = (
                net_amount * ECOSYSTEM_SHARE / 100.0
            )

            security_amount = (
                net_amount * SECURITY_SHARE / 100.0
            )

            conn.execute(
                """
                INSERT OR IGNORE INTO economic_balances (
                    category,
                    amount_3m,
                    reference,
                    created_at
                )
                VALUES (?, ?, ?, ?)
                """,
                (
                    "revenue_reward_pool",
                    reward_amount,
                    reference,
                    timestamp
                )
            )

            # Treasury receives its real-currency accounting allocation.
            treasury_reference = (
                f"{reference}:treasury"
            )

            conn.execute(
                """
                INSERT OR IGNORE INTO treasury_ledger (
                    source,
                    amount,
                    currency,
                    reference,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    "verified_revenue",
                    treasury_amount,
                    currency,
                    treasury_reference,
                    timestamp
                )
            )

            conn.commit()

            return {
                "success": True,
                "reference": reference,
                "status": "verified",
                "currency": currency,
                "net_revenue": net_amount,
                "allocation": {
                    "reward_pool": reward_amount,
                    "treasury_reserve": treasury_amount,
                    "ai_platform": ai_amount,
                    "development": development_amount,
                    "ecosystem": ecosystem_amount,
                    "security": security_amount
                }
            }

        finally:
            conn.close()


# =========================================================
# UTILITY / SPENDING
# =========================================================

def spend_3m(
    telegram_id: int,
    service: str,
    amount_3m: float,
    reference: Optional[str] = None
) -> Dict[str, Any]:

    if amount_3m <= 0:
        raise ValueError("Spend amount must be positive.")

    ensure_user_account(telegram_id)

    reference = reference or (
        f"utility:{telegram_id}:{service}:{now_iso()}"
    )

    with _db_lock:
        conn = get_connection()

        try:
            existing = conn.execute(
                """
                SELECT *
                FROM utility_transactions
                WHERE reference = ?
                """,
                (reference,)
            ).fetchone()

            if existing is not None:
                return {
                    "success": True,
                    "duplicate": True,
                    "transaction": dict(existing)
                }

            user = conn.execute(
                """
                SELECT unlocked_3m
                FROM economic_users
                WHERE telegram_id = ?
                """,
                (telegram_id,)
            ).fetchone()

            unlocked = float(user["unlocked_3m"])

            if amount_3m > unlocked:
                raise ValueError(
                    "Insufficient unlocked 3M balance."
                )

            timestamp = now_iso()

            conn.execute(
                """
                UPDATE economic_users
                SET unlocked_3m =
                    unlocked_3m - ?,
                    updated_at = ?
                WHERE telegram_id = ?
                """,
                (
                    amount_3m,
                    timestamp,
                    telegram_id
                )
            )

            conn.execute(
                """
                INSERT INTO utility_transactions (
                    telegram_id,
                    service,
                    amount_3m,
                    reference,
                    status,
                    created_at
                )
                VALUES (?, ?, ?, ?, 'completed', ?)
                """,
                (
                    telegram_id,
                    service,
                    amount_3m,
                    reference,
                    timestamp
                )
            )

            conn.execute(
                """
                INSERT INTO economic_audit_log (
                    action,
                    telegram_id,
                    amount_3m,
                    reference,
                    details,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    "3m_spent",
                    telegram_id,
                    amount_3m,
                    reference,
                    service,
                    timestamp
                )
            )

            conn.commit()

            return {
                "success": True,
                "duplicate": False,
                "telegram_id": telegram_id,
                "service": service,
                "amount_3m": amount_3m,
                "reference": reference,
                "status": "completed"
            }

        finally:
            conn.close()


# =========================================================
# AIRDROP PREVIEW
# =========================================================

def calculate_airdrop_preview(
    telegram_id: int,
    eligible_pool: Optional[float] = None
) -> Dict[str, Any]:

    ensure_user_account(telegram_id)

    if eligible_pool is None:
        eligible_pool = AIRDROP_ALLOCATION

    if eligible_pool < 0:
        raise ValueError(
            "Eligible pool cannot be negative."
        )

    with _db_lock:
        conn = get_connection()

        try:
            total_score_row = conn.execute(
                """
                SELECT COALESCE(
                    SUM(contribution_score), 0
                ) AS total_score
                FROM economic_users
                """
            ).fetchone()

            user = conn.execute(
                """
                SELECT contribution_score
                FROM economic_users
                WHERE telegram_id = ?
                """,
                (telegram_id,)
            ).fetchone()

            total_score = float(
                total_score_row["total_score"]
            )

            user_score = float(
                user["contribution_score"]
            )

            if total_score <= 0:
                estimated = 0.0
            else:
                estimated = (
                    eligible_pool
                    * user_score
                    / total_score
                )

            return {
                "telegram_id": telegram_id,
                "eligible_pool": eligible_pool,
                "user_contribution_score": user_score,
                "total_contribution_score": total_score,
                "estimated_airdrop_3m": estimated
            }

        finally:
            conn.close()


# =========================================================
# USER PROFILE
# =========================================================

def user_economic_profile(
    telegram_id: int
) -> Dict[str, Any]:

    ensure_user_account(telegram_id)

    with _db_lock:
        conn = get_connection()

        try:
            row = conn.execute(
                """
                SELECT *
                FROM economic_users
                WHERE telegram_id = ?
                """,
                (telegram_id,)
            ).fetchone()

            return {
                "telegram_id": telegram_id,
                "total_mined": float(row["total_mined"]),
                "locked_3m": float(row["locked_3m"]),
                "airdrop_3m": float(row["airdrop_3m"]),
                "unlocked_3m": float(row["unlocked_3m"]),
                "contribution_score": float(
                    row["contribution_score"]
                ),
                "trust_score": float(
                    row["trust_score"]
                )
            }

        finally:
            conn.close()


# =========================================================
# ECONOMIC SUMMARY
# =========================================================

def economic_summary() -> Dict[str, Any]:

    init_economic_engine()

    tokenomics = validate_tokenomics()
    capacity = economic_capacity()

    with _db_lock:
        conn = get_connection()

        try:
            users = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM economic_users
                """
            ).fetchone()["count"]

            contribution = conn.execute(
                """
                SELECT COALESCE(
                    SUM(contribution_score), 0
                ) AS total
                FROM economic_users
                """
            ).fetchone()["total"]

            return {
                "project": "3Migo",
                "version": ENGINE_VERSION,
                "unit": "3M",
                "tokenomics": tokenomics,
                "capacity": capacity,
                "economic_users": int(users),
                "total_contribution_score": float(
                    contribution
                ),
                "status": "internal_economic_layer",
                "blockchain": "not_active",
                "market_value": "not_defined"
            }

        finally:
            conn.close()


# =========================================================
# HEALTH
# =========================================================

def health() -> Dict[str, Any]:
    tokenomics = validate_tokenomics()

    return {
        "status": "ok",
        "engine": "3Migo Economic Engine",
        "version": ENGINE_VERSION,
        "tokenomics_valid": tokenomics["valid"],
        "max_supply": MAX_SUPPLY
    }
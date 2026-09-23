"""
=========================================================
3MIGO ECONOMIC ENGINE V1.0
=========================================================

Purpose:
    Economic layer for the 3Migo ecosystem.

Responsibilities:
    - Maximum supply control
    - Mining allocation tracking
    - Reward pool tracking
    - Treasury tracking
    - Contribution Score
    - Locked 3M balances
    - Airdrop preparation
    - Economic statistics
    - Revenue-backed reward capacity

Important:
    This module does NOT create a blockchain token.
    It operates on the internal 3M accounting system.

=========================================================
"""

import os
import sqlite3
import threading
from datetime import datetime

import db


# =========================================================
# CONFIGURATION
# =========================================================

MAX_SUPPLY = 3_000_000_000.0

MINING_ALLOCATION = 1_350_000_000.0
AIRDROP_ALLOCATION = 300_000_000.0
LIQUIDITY_ALLOCATION = 450_000_000.0
TREASURY_ALLOCATION = 450_000_000.0
ECOSYSTEM_ALLOCATION = 300_000_000.0
DEVELOPMENT_ALLOCATION = 150_000_000.0


# =========================================================
# ECONOMIC LOCK
# =========================================================

_economic_lock = threading.RLock()


# =========================================================
# TIME
# =========================================================

def utc_now():
    return datetime.utcnow()


def utc_now_iso():
    return utc_now().isoformat()


# =========================================================
# DATABASE
# =========================================================

def get_conn():
    return db.get_conn()


# =========================================================
# TOKENOMICS VALIDATION
# =========================================================

def validate_tokenomics():
    allocation_total = (
        MINING_ALLOCATION
        + AIRDROP_ALLOCATION
        + LIQUIDITY_ALLOCATION
        + TREASURY_ALLOCATION
        + ECOSYSTEM_ALLOCATION
        + DEVELOPMENT_ALLOCATION
    )

    valid = (
        abs(allocation_total - MAX_SUPPLY)
        < 0.000001
    )

    return {
        "valid": valid,
        "max_supply": MAX_SUPPLY,
        "allocation_total": allocation_total,
        "difference": MAX_SUPPLY - allocation_total,
        "allocations": {
            "mining": MINING_ALLOCATION,
            "airdrop": AIRDROP_ALLOCATION,
            "liquidity": LIQUIDITY_ALLOCATION,
            "treasury": TREASURY_ALLOCATION,
            "ecosystem": ECOSYSTEM_ALLOCATION,
            "development": DEVELOPMENT_ALLOCATION
        }
    }


# =========================================================
# INITIALIZATION
# =========================================================

def init_economic_engine():
    """
    Create all economic tables required by the engine.

    Existing 3Migo tables are preserved.
    """

    with _economic_lock:
        connection = get_conn()

        try:

            # -------------------------------------------------
            # ECONOMIC STATE
            # -------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS economic_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),

                    max_supply REAL NOT NULL,

                    mining_allocation REAL NOT NULL,
                    airdrop_allocation REAL NOT NULL,
                    liquidity_allocation REAL NOT NULL,
                    treasury_allocation REAL NOT NULL,
                    ecosystem_allocation REAL NOT NULL,
                    development_allocation REAL NOT NULL,

                    total_mined REAL DEFAULT 0,
                    total_locked REAL DEFAULT 0,
                    total_airdrop REAL DEFAULT 0,
                    total_unlocked REAL DEFAULT 0,

                    reward_pool_usd REAL DEFAULT 0,
                    treasury_usd REAL DEFAULT 0,

                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            # -------------------------------------------------
            # USER ECONOMIC BALANCES
            # -------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS economic_balances (
                    telegram_id INTEGER PRIMARY KEY,

                    total_mined REAL DEFAULT 0,
                    locked_3m REAL DEFAULT 0,
                    airdrop_3m REAL DEFAULT 0,
                    unlocked_3m REAL DEFAULT 0,

                    contribution_score REAL DEFAULT 0,
                    trust_score REAL DEFAULT 100,

                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            # -------------------------------------------------
            # REWARD POOL LEDGER
            # -------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS reward_pool_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    event_type TEXT NOT NULL,

                    amount_usd REAL DEFAULT 0,

                    amount_3m REAL DEFAULT 0,

                    reference TEXT DEFAULT '',

                    created_at TEXT NOT NULL
                )
            """)

            # -------------------------------------------------
            # LOCK LEDGER
            # -------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS lock_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    telegram_id INTEGER NOT NULL,

                    amount_3m REAL NOT NULL,

                    source TEXT DEFAULT '',

                    reference TEXT DEFAULT '',

                    created_at TEXT NOT NULL
                )
            """)

            # -------------------------------------------------
            # CONTRIBUTION LEDGER
            # -------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS contribution_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    telegram_id INTEGER NOT NULL,

                    event_type TEXT NOT NULL,

                    score REAL NOT NULL,

                    reference TEXT DEFAULT '',

                    created_at TEXT NOT NULL
                )
            """)

            # -------------------------------------------------
            # AIRDROP LEDGER
            # -------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS airdrop_ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    telegram_id INTEGER NOT NULL,

                    amount_3m REAL NOT NULL,

                    status TEXT DEFAULT 'allocated',

                    reference TEXT DEFAULT '',

                    created_at TEXT NOT NULL
                )
            """)

            # -------------------------------------------------
            # INDEXES
            # -------------------------------------------------

            connection.execute("""
                CREATE INDEX IF NOT EXISTS
                idx_economic_balance_score
                ON economic_balances(contribution_score)
            """)

            connection.execute("""
                CREATE INDEX IF NOT EXISTS
                idx_contribution_user
                ON contribution_ledger(telegram_id)
            """)

            connection.execute("""
                CREATE INDEX IF NOT EXISTS
                idx_lock_user
                ON lock_ledger(telegram_id)
            """)

            # -------------------------------------------------
            # INITIAL ECONOMIC STATE
            # -------------------------------------------------

            existing = connection.execute("""
                SELECT id
                FROM economic_state
                WHERE id=1
            """).fetchone()

            if existing is None:

                now = utc_now_iso()

                connection.execute("""
                    INSERT INTO economic_state (
                        id,
                        max_supply,
                        mining_allocation,
                        airdrop_allocation,
                        liquidity_allocation,
                        treasury_allocation,
                        ecosystem_allocation,
                        development_allocation,
                        total_mined,
                        total_locked,
                        total_airdrop,
                        total_unlocked,
                        reward_pool_usd,
                        treasury_usd,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        1,
                        ?, ?, ?, ?, ?, ?,
                        ?, 0, 0, 0, 0, 0, 0, ?, ?
                    )
                """, (
                    MAX_SUPPLY,
                    MINING_ALLOCATION,
                    AIRDROP_ALLOCATION,
                    LIQUIDITY_ALLOCATION,
                    TREASURY_ALLOCATION,
                    ECOSYSTEM_ALLOCATION,
                    DEVELOPMENT_ALLOCATION,
                    now,
                    now
                ))

            connection.commit()

        finally:
            connection.close()


# =========================================================
# USER ECONOMIC ACCOUNT
# =========================================================

def ensure_user_account(telegram_id):
    init_economic_engine()

    with _economic_lock:
        connection = get_conn()

        try:

            user = connection.execute("""
                SELECT *
                FROM economic_balances
                WHERE telegram_id=?
            """, (telegram_id,)).fetchone()

            if user:
                return dict(user)

            now = utc_now_iso()

            connection.execute("""
                INSERT INTO economic_balances (
                    telegram_id,
                    total_mined,
                    locked_3m,
                    airdrop_3m,
                    unlocked_3m,
                    contribution_score,
                    trust_score,
                    created_at,
                    updated_at
                )
                VALUES (?, 0, 0, 0, 0, 0, 100, ?, ?)
            """, (
                telegram_id,
                now,
                now
            ))

            connection.commit()

            user = connection.execute("""
                SELECT *
                FROM economic_balances
                WHERE telegram_id=?
            """, (telegram_id,)).fetchone()

            return dict(user)

        finally:
            connection.close()


# =========================================================
# CONTRIBUTION SCORE
# =========================================================

def add_contribution(
    telegram_id,
    event_type,
    score,
    reference=""
):
    """
    Add contribution points to a user.

    Score is an internal measurement.
    It is NOT a financial balance.
    """

    init_economic_engine()

    score = max(0.0, float(score))

    ensure_user_account(telegram_id)

    with _economic_lock:
        connection = get_conn()

        try:

            connection.execute("""
                INSERT INTO contribution_ledger (
                    telegram_id,
                    event_type,
                    score,
                    reference,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
            """, (
                telegram_id,
                event_type or "activity",
                score,
                reference or "",
                utc_now_iso()
            ))

            connection.execute("""
                UPDATE economic_balances
                SET contribution_score =
                    contribution_score + ?,
                    updated_at=?
                WHERE telegram_id=?
            """, (
                score,
                utc_now_iso(),
                telegram_id
            ))

            connection.commit()

            row = connection.execute("""
                SELECT *
                FROM economic_balances
                WHERE telegram_id=?
            """, (telegram_id,)).fetchone()

            return dict(row)

        finally:
            connection.close()


# =========================================================
# TRUST SCORE
# =========================================================

def set_trust_score(
    telegram_id,
    trust_score
):
    ensure_user_account(telegram_id)

    trust_score = max(
        0.0,
        min(100.0, float(trust_score))
    )

    with _economic_lock:
        connection = get_conn()

        try:

            connection.execute("""
                UPDATE economic_balances
                SET trust_score=?,
                    updated_at=?
                WHERE telegram_id=?
            """, (
                trust_score,
                utc_now_iso(),
                telegram_id
            ))

            connection.commit()

            row = connection.execute("""
                SELECT *
                FROM economic_balances
                WHERE telegram_id=?
            """, (telegram_id,)).fetchone()

            return dict(row)

        finally:
            connection.close()


# =========================================================
# MINING REWARD REGISTRATION
# =========================================================

def register_mining_reward(
    telegram_id,
    amount_3m,
    reference=""
):
    """
    Register a mining reward as LOCKED 3M.

    The existing db.py balance is not modified here.
    This function is the economic-layer record.
    """

    init_economic_engine()

    amount = max(0.0, float(amount_3m))

    if amount <= 0:
        return {
            "status": "invalid_amount"
        }

    ensure_user_account(telegram_id)

    with _economic_lock:
        connection = get_conn()

        try:

            state = connection.execute("""
                SELECT *
                FROM economic_state
                WHERE id=1
            """).fetchone()

            total_mined = float(
                state["total_mined"] or 0
            )

            remaining = (
                MINING_ALLOCATION
                - total_mined
            )

            if amount > remaining:
                return {
                    "status": "mining_pool_exceeded",
                    "requested": amount,
                    "remaining": remaining
                }

            # User economic balance
            connection.execute("""
                UPDATE economic_balances
                SET total_mined =
                        total_mined + ?,
                    locked_3m =
                        locked_3m + ?,
                    updated_at=?
                WHERE telegram_id=?
            """, (
                amount,
                amount,
                utc_now_iso(),
                telegram_id
            ))

            # Global state
            connection.execute("""
                UPDATE economic_state
                SET total_mined =
                        total_mined + ?,
                    total_locked =
                        total_locked + ?,
                    updated_at=?
                WHERE id=1
            """, (
                amount,
                amount,
                utc_now_iso()
            ))

            # Lock ledger
            connection.execute("""
                INSERT INTO lock_ledger (
                    telegram_id,
                    amount_3m,
                    source,
                    reference,
                    created_at
                )
                VALUES (?, ?, 'mining', ?, ?)
            """, (
                telegram_id,
                amount,
                reference or "",
                utc_now_iso()
            ))

            connection.commit()

            return {
                "status": "registered",
                "telegram_id": telegram_id,
                "amount_3m": amount,
                "locked": amount
            }

        finally:
            connection.close()


# =========================================================
# REWARD POOL
# =========================================================

def add_reward_pool_funds(
    amount_usd,
    reference=""
):
    """
    Add verified revenue allocation
    to the reward pool.
    """

    init_economic_engine()

    amount = max(0.0, float(amount_usd))

    if amount <= 0:
        return {
            "status": "invalid_amount"
        }

    with _economic_lock:
        connection = get_conn()

        try:

            connection.execute("""
                UPDATE economic_state
                SET reward_pool_usd =
                    reward_pool_usd + ?,
                    updated_at=?
                WHERE id=1
            """, (
                amount,
                utc_now_iso()
            ))

            connection.execute("""
                INSERT INTO reward_pool_ledger (
                    event_type,
                    amount_usd,
                    amount_3m,
                    reference,
                    created_at
                )
                VALUES (
                    'revenue_allocation',
                    ?,
                    0,
                    ?,
                    ?
                )
            """, (
                amount,
                reference or "",
                utc_now_iso()
            ))

            connection.commit()

            return {
                "status": "funded",
                "amount_usd": amount,
                "reference": reference
            }

        finally:
            connection.close()


# =========================================================
# TREASURY
# =========================================================

def add_treasury_funds(
    amount_usd,
    reference=""
):
    """
    Register verified revenue allocated
    to Treasury.
    """

    init_economic_engine()

    amount = max(0.0, float(amount_usd))

    if amount <= 0:
        return {
            "status": "invalid_amount"
        }

    with _economic_lock:
        connection = get_conn()

        try:

            connection.execute("""
                UPDATE economic_state
                SET treasury_usd =
                    treasury_usd + ?,
                    updated_at=?
                WHERE id=1
            """, (
                amount,
                utc_now_iso()
            ))

            connection.execute("""
                INSERT INTO reward_pool_ledger (
                    event_type,
                    amount_usd,
                    amount_3m,
                    reference,
                    created_at
                )
                VALUES (
                    'treasury_allocation',
                    ?,
                    0,
                    ?,
                    ?
                )
            """, (
                amount,
                reference or "",
                utc_now_iso()
            ))

            connection.commit()

            return {
                "status": "funded",
                "amount_usd": amount,
                "reference": reference
            }

        finally:
            connection.close()


# =========================================================
# REVENUE SYNC
# =========================================================

def sync_confirmed_revenue():
    """
    Synchronize confirmed revenue from db.py.

    This function reads the existing revenue table and
    records its Reward Pool and Treasury allocations.

    It uses a reference marker to avoid double counting.
    """

    init_economic_engine()
    db.init_revenue()

    with _economic_lock:
        connection = get_conn()

        try:

            rows = connection.execute("""
                SELECT *
                FROM revenue
                WHERE status='confirmed'
                ORDER BY id ASC
            """).fetchall()

            synced = 0

            for row in rows:

                reference = (
                    f"revenue:{row['id']}"
                )

                existing = connection.execute("""
                    SELECT id
                    FROM reward_pool_ledger
                    WHERE reference=?
                    LIMIT 1
                """, (
                    reference
                )).fetchone()

                if existing:
                    continue

                reward_pool = float(
                    row["reward_pool_amount"] or 0
                )

                treasury = float(
                    row["treasury_amount"] or 0
                )

                if reward_pool > 0:

                    connection.execute("""
                        UPDATE economic_state
                        SET reward_pool_usd =
                            reward_pool_usd + ?,
                            updated_at=?
                        WHERE id=1
                    """, (
                        reward_pool,
                        utc_now_iso()
                    ))

                if treasury > 0:

                    connection.execute("""
                        UPDATE economic_state
                        SET treasury_usd =
                            treasury_usd + ?,
                            updated_at=?
                        WHERE id=1
                    """, (
                        treasury,
                        utc_now_iso()
                    ))

                connection.execute("""
                    INSERT INTO reward_pool_ledger (
                        event_type,
                        amount_usd,
                        amount_3m,
                        reference,
                        created_at
                    )
                    VALUES (
                        'revenue_sync',
                        ?,
                        0,
                        ?,
                        ?
                    )
                """, (
                    reward_pool,
                    reference,
                    utc_now_iso()
                ))

                if treasury > 0:

                    connection.execute("""
                        INSERT INTO reward_pool_ledger (
                            event_type,
                            amount_usd,
                            amount_3m,
                            reference,
                            created_at
                        )
                        VALUES (
                            'treasury_sync',
                            ?,
                            0,
                            ?,
                            ?
                        )
                    """, (
                        treasury,
                        reference,
                        utc_now_iso()
                    ))

                synced += 1

            connection.commit()

            return {
                "status": "synced",
                "records_synced": synced
            }

        finally:
            connection.close()


# =========================================================
# ECONOMIC CAPACITY
# =========================================================

def economic_capacity():
    """
    Return current economic capacity.

    This does NOT assign a market price to 3M.

    It only reports verified revenue-backed
    reward capacity.
    """

    init_economic_engine()

    with _economic_lock:
        connection = get_conn()

        try:

            state = connection.execute("""
                SELECT *
                FROM economic_state
                WHERE id=1
            """).fetchone()

            mined_remaining = max(
                0.0,
                MINING_ALLOCATION
                - float(state["total_mined"] or 0)
            )

            return {
                "max_supply": MAX_SUPPLY,

                "mining_allocation":
                    MINING_ALLOCATION,

                "total_mined":
                    float(state["total_mined"] or 0),

                "remaining_mining":
                    mined_remaining,

                "total_locked":
                    float(state["total_locked"] or 0),

                "reward_pool_usd":
                    float(state["reward_pool_usd"] or 0),

                "treasury_usd":
                    float(state["treasury_usd"] or 0),

                "economic_principle":
                    "Rewards must remain within "
                    "the approved economic capacity."
            }

        finally:
            connection.close()


# =========================================================
# USER ECONOMIC PROFILE
# =========================================================

def user_economic_profile(
    telegram_id
):
    init_economic_engine()

    account = ensure_user_account(
        telegram_id
    )

    return {
        "telegram_id": telegram_id,
        "total_mined":
            float(account["total_mined"] or 0),
        "locked_3m":
            float(account["locked_3m"] or 0),
        "airdrop_3m":
            float(account["airdrop_3m"] or 0),
        "unlocked_3m":
            float(account["unlocked_3m"] or 0),
        "contribution_score":
            float(
                account["contribution_score"] or 0
            ),
        "trust_score":
            float(account["trust_score"] or 0)
    }


# =========================================================
# AIRDROP PREVIEW
# =========================================================

def calculate_airdrop_preview():
    """
    Calculate proportional Airdrop weights.

    This does NOT allocate or transfer anything.

    It is a preview only.
    """

    init_economic_engine()

    with _economic_lock:
        connection = get_conn()

        try:

            users = connection.execute("""
                SELECT
                    telegram_id,
                    contribution_score,
                    trust_score
                FROM economic_balances
                WHERE contribution_score > 0
                ORDER BY contribution_score DESC
            """).fetchall()

            total_score = sum(
                float(row["contribution_score"] or 0)
                for row in users
                if float(row["trust_score"] or 0) > 0
            )

            results = []

            if total_score <= 0:

                return {
                    "status": "no_eligible_score",
                    "total_score": 0,
                    "users": []
                }

            for row in users:

                score = float(
                    row["contribution_score"] or 0
                )

                trust = float(
                    row["trust_score"] or 0
                )

                if trust <= 0:
                    continue

                weight = (
                    score / total_score
                )

                allocation = (
                    AIRDROP_ALLOCATION
                    * weight
                )

                results.append({
                    "telegram_id":
                        row["telegram_id"],

                    "contribution_score":
                        score,

                    "trust_score":
                        trust,

                    "weight":
                        round(weight, 10),

                    "airdrop_3m":
                        round(allocation, 8)
                })

            return {
                "status": "preview",
                "airdrop_pool":
                    AIRDROP_ALLOCATION,
                "total_score":
                    total_score,
                "users":
                    results
            }

        finally:
            connection.close()


# =========================================================
# ECONOMIC SUMMARY
# =========================================================

def economic_summary():
    """
    Complete economic status.
    """

    init_economic_engine()

    tokenomics = validate_tokenomics()
    capacity = economic_capacity()

    with _economic_lock:
        connection = get_conn()

        try:

            users = connection.execute("""
                SELECT COUNT(*) AS count
                FROM economic_balances
            """).fetchone()["count"]

            total_score = connection.execute("""
                SELECT
                    COALESCE(
                        SUM(contribution_score),
                        0
                    ) AS total
                FROM economic_balances
            """).fetchone()["total"]

            return {
                "project": "3Migo",
                "version": "1.0",
                "unit": "3M",

                "tokenomics":
                    tokenomics,

                "capacity":
                    capacity,

                "economic_users":
                    users,

                "total_contribution_score":
                    float(total_score or 0),

                "status":
                    "internal_economic_layer",

                "blockchain":
                    "not_active",

                "market_value":
                    "not_defined"
            }

        finally:
            connection.close()


# =========================================================
# HEALTH CHECK
# =========================================================

def health():
    """
    Simple engine health check.
    """

    try:

        init_economic_engine()

        tokenomics = validate_tokenomics()

        return {
            "status": "ok",
            "engine": "3Migo Economic Engine",
            "version": "1.0",
            "tokenomics_valid":
                tokenomics["valid"],
            "max_supply":
                MAX_SUPPLY
        }

    except Exception as error:

        return {
            "status": "error",
            "engine":
                "3Migo Economic Engine",
            "error":
                str(error)
        }
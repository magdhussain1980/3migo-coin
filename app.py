import os

from fastapi import FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import db


# =========================================================
# 3MIGO COIN — APPLICATION
# =========================================================

app = FastAPI(
    title="3Migo Coin",
    version="2.0.0",
    description="3Migo Coin Telegram Mini App Backend"
)


# =========================================================
# WEB APP
# =========================================================

WEBAPP_DIR = os.path.join(
    os.path.dirname(__file__),
    "webapp"
)

app.mount(
    "/webapp",
    StaticFiles(directory=WEBAPP_DIR),
    name="webapp"
)


@app.get("/miniapp")
def miniapp():
    return FileResponse(
        os.path.join(
            WEBAPP_DIR,
            "index.html"
        )
    )


# =========================================================
# MODELS
# =========================================================

class Register(BaseModel):
    telegram_id: int
    username: str = ""
    referral_code: str = ""


class ReferralIn(BaseModel):
    referral_code: str = ""


class RevenueIn(BaseModel):
    source: str = Field(
        pattern="^(telegram_ads|direct_ads|affiliate|tasks|partnership)$"
    )
    campaign_id: str = ""
    gross_amount: float = Field(gt=0)
    currency: str = "USD"
    notes: str = ""
    status: str = "confirmed"


# =========================================================
# ADMIN SECURITY
# =========================================================

def require_admin(key: str):
    expected = os.getenv("ADMIN_KEY", "")

    if not expected or key != expected:
        raise HTTPException(
            status_code=401,
            detail="invalid_admin_key"
        )


# =========================================================
# STARTUP
# =========================================================

@app.on_event("startup")
def startup():
    db.init_db()
    db.init_tasks()


# =========================================================
# SYSTEM
# =========================================================

@app.get("/")
def home():
    return {
        "project": "3Migo Coin",
        "version": "2.0.0",
        "status": "online",
        "token": "3M",
        "max_supply_draft": 3000000000,
        "mining_cycle_hours": int(
            os.getenv("MINING_CYCLE_HOURS", "12")
        ),
        "mining_reward": float(
            os.getenv("MINING_REWARD", "10")
        )
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "3Migo Coin API",
        "version": "2.0.0"
    }


# =========================================================
# USER
# =========================================================

@app.post("/register")
def register(data: Register):
    user, status = db.create_user(
        data.telegram_id,
        data.username,
        data.referral_code
    )

    return {
        "status": status,
        "user": dict(user)
    }


@app.get("/user/{telegram_id}")
def user(telegram_id: int):

    result = db.get_user(telegram_id)

    if not result:
        return {
            "error": "user_not_found"
        }

    return dict(result)


# =========================================================
# DAILY REWARD
# =========================================================

@app.post("/user/{telegram_id}/daily")
def daily(telegram_id: int):

    user, status = db.claim_daily(telegram_id)

    if status == "user_not_found":
        return {
            "error": status
        }

    if status == "already_claimed":
        return {
            "error": status,
            "user": dict(user)
        }

    return dict(user)


# =========================================================
# MINING — STATUS
# =========================================================

@app.get("/mining/{telegram_id}/status")
def mining_status(telegram_id: int):

    result = db.mining_status(telegram_id)

    if result.get("status") == "user_not_found":
        return {
            "status": "user_not_found"
        }

    return result


# =========================================================
# MINING — START
# =========================================================

@app.post("/mining/{telegram_id}/start")
def mining_start(telegram_id: int):

    session, status = db.start_mining(
        telegram_id
    )

    if status == "user_not_found":
        return {
            "status": "user_not_found"
        }

    if status == "already_mining":
        return {
            "status": "already_mining",
            "session": dict(session)
        }

    if status == "ready_to_claim":
        return {
            "status": "ready_to_claim",
            "session": dict(session)
        }

    if status == "started":
        return {
            "status": "started",
            "session": dict(session)
        }

    return {
        "status": status,
        "session": dict(session) if session else None
    }


# =========================================================
# MINING — CLAIM
# =========================================================

@app.post("/mining/{telegram_id}/claim")
def mining_claim(telegram_id: int):

    user, status = db.claim_mining(
        telegram_id
    )

    if status == "user_not_found":
        return {
            "status": "user_not_found"
        }

    if status == "not_found":
        return {
            "status": "not_found"
        }

    if status == "not_ready":
        return {
            "status": "not_ready",
            "user": dict(user) if user else None
        }

    if status == "already_claimed":
        return {
            "status": "already_claimed",
            "user": dict(user) if user else None
        }

    if status == "claimed":

        reward = float(
            os.getenv(
                "MINING_REWARD",
                "10"
            )
        )

        return {
            "status": "claimed",
            "reward": reward,
            "user": dict(user)
        }

    return {
        "status": status,
        "user": dict(user) if user else None
    }


# =========================================================
# LEGACY MINING ENDPOINT
# =========================================================

@app.post("/user/{telegram_id}/mine")
def legacy_mine(telegram_id: int):

    """
    Compatibility endpoint for the old frontend.

    IMPORTANT:
    It no longer gives an immediate reward.

    It starts the mining cycle instead.
    """

    session, status = db.start_mining(
        telegram_id
    )

    if status == "user_not_found":
        return {
            "status": "user_not_found"
        }

    if status == "already_mining":
        return {
            "status": "already_mining",
            "session": dict(session)
        }

    if status == "ready_to_claim":
        return {
            "status": "ready_to_claim",
            "session": dict(session)
        }

    if status == "started":
        return {
            "status": "started",
            "session": dict(session)
        }

    return {
        "status": status,
        "session": dict(session) if session else None
    }


# =========================================================
# TRANSACTIONS
# =========================================================

@app.get("/transactions/{telegram_id}")
def user_transactions(telegram_id: int):

    return db.transactions(
        telegram_id
    )


# =========================================================
# TASKS — PUBLIC
# =========================================================

@app.get("/tasks")
def tasks():

    conn = db.conn()

    try:
        rows = conn.execute(
            """
            SELECT
                id,
                title,
                description,
                reward_3m,
                task_type,
                task_url,
                active
            FROM tasks
            WHERE active = 1
            ORDER BY id
            """
        ).fetchall()

        return [
            dict(row)
            for row in rows
        ]

    finally:
        conn.close()


# =========================================================
# TASKS — USER
# =========================================================

@app.get("/tasks/{telegram_id}")
def tasks_for_user(
    telegram_id: int
):

    user = db.get_user(
        telegram_id
    )

    if not user:
        return {
            "error": "user_not_found"
        }

    return db.get_tasks(
        telegram_id
    )


# =========================================================
# TASKS — COMPLETE
# =========================================================

@app.post("/tasks/{telegram_id}/complete/{task_id}")
def complete_user_task(
    telegram_id: int,
    task_id: int
):

    # الحصول على المكافأة قبل إكمال المهمة
    available_tasks = db.get_tasks(
        telegram_id
    )

    selected_task = None

    for task in available_tasks:

        if int(task["id"]) == int(task_id):
            selected_task = task
            break

    if not selected_task:

        return {
            "status": "task_not_found",
            "user": db.get_user(telegram_id)
        }

    reward = float(
        selected_task["reward_3m"]
    )

    user, status = db.complete_task(
        telegram_id,
        task_id
    )

    if status == "completed":

        return {
            "status": "completed",
            "reward": reward,
            "user": dict(user)
        }

    if status == "already_completed":

        return {
            "status": "already_completed",
            "reward": 0,
            "user": dict(user)
        }

    return {
        "status": status,
        "reward": 0,
        "user": dict(user) if user else None
    }


# =========================================================
# REFERRAL — INFORMATION
# =========================================================

@app.get("/referral/{telegram_id}")
def referral_info(
    telegram_id: int
):

    user = db.get_user(
        telegram_id
    )

    if not user:

        return {
            "error": "user_not_found"
        }

    conn = db.get_conn()

    try:

        row = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM users
            WHERE referred_by = ?
            """,
            (
                user["referral_code"],
            )
        ).fetchone()

        referral_count = (
            row["count"]
            if row
            else 0
        )

        row = conn.execute(
            """
            SELECT
                COALESCE(
                    SUM(amount),
                    0
                ) AS total
            FROM transactions
            WHERE telegram_id = ?
              AND transaction_type =
                  'referral_reward'
            """,
            (
                telegram_id,
            )
        ).fetchone()

        referral_rewards = (
            row["total"]
            if row
            else 0
        )

        return {
            "telegram_id": telegram_id,
            "referral_code": user["referral_code"],
            "referral_count": referral_count,
            "referral_rewards": float(
                referral_rewards
            )
        }

    finally:
        conn.close()


# =========================================================
# REFERRAL — APPLY
# =========================================================

@app.post("/referral/{telegram_id}")
def apply_referral_api(
    telegram_id: int,
    data: ReferralIn
):

    if not data.referral_code:

        return {
            "status": "missing_referral_code"
        }

    result, status = db.apply_referral(
        telegram_id,
        data.referral_code
    )

    return {
        "status": status,
        "user": (
            dict(result)
            if result
            else None
        ),
        "reward": (
            25
            if status == "referral_applied"
            else 0
        )
    }


# =========================================================
# ADMIN — STATS
# =========================================================

@app.get("/admin/stats")
def admin_stats(
    x_admin_key: str = Header(default="")
):

    require_admin(
        x_admin_key
    )

    return db.stats()


# =========================================================
# ADMIN — REVENUE
# =========================================================

@app.get("/admin/revenue")
def admin_revenue(
    x_admin_key: str = Header(default="")
):

    require_admin(
        x_admin_key
    )

    return db.all_revenue()


@app.post("/admin/revenue")
def create_revenue(
    data: RevenueIn,
    x_admin_key: str = Header(default="")
):

    require_admin(
        x_admin_key
    )

    revenue_id = db.add_revenue(
        data.source,
        data.campaign_id,
        data.gross_amount,
        data.currency,
        data.notes,
        data.status
    )

    allocations = db.allocate_revenue(
        revenue_id,
        float(
            os.getenv(
                "REWARD_POOL_SHARE",
                "0.40"
            )
        )
    )

    return {
        "revenue_id": revenue_id,
        "allocations": allocations
    }


# =========================================================
# ADMIN — TREASURY
# =========================================================

@app.get("/admin/treasury")
def treasury(
    x_admin_key: str = Header(default="")
):

    require_admin(
        x_admin_key
    )

    conn = db.conn()

    try:

        # التحقق من وجود جدول treasury
        table = conn.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name = 'treasury'
            """
        ).fetchone()

        if not table:

            return []

        rows = conn.execute(
            """
            SELECT
                category,
                currency,
                ROUND(
                    SUM(amount),
                    2
                ) AS amount
            FROM treasury
            GROUP BY
                category,
                currency
            ORDER BY
                category
            """
        ).fetchall()

        return [
            dict(row)
            for row in rows
        ]

    finally:
        conn.close()
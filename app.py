import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import db


# =========================================================
# 3MIGO COIN API — VERSION 3.1
# Admin Dashboard Foundation
# Revenue Engine + Mining + Tasks + Referral
# =========================================================

APP_VERSION = "3.1.0"

app = FastAPI(
    title="3Migo Coin",
    version=APP_VERSION,
    description="3Migo Smart Revenue & Rewards API"
)


# =========================================================
# STATIC FILES
# =========================================================

try:
    app.mount(
        "/webapp",
        StaticFiles(
            directory="webapp",
            html=True
        ),
        name="webapp"
    )
except Exception:
    pass


# =========================================================
# CONFIGURATION
# =========================================================

MINING_CYCLE_HOURS = float(
    os.getenv("MINING_CYCLE_HOURS", "12")
)

MINING_REWARD = float(
    os.getenv("MINING_REWARD", "10")
)


# =========================================================
# DATA MODELS
# =========================================================

class Register(BaseModel):
    telegram_id: int
    username: str = ""
    referral_code: str = ""


class ReferralIn(BaseModel):
    referral_code: str = ""


class RevenueIn(BaseModel):
    source: str = Field(
        min_length=1,
        max_length=100
    )

    campaign_id: str = ""

    ad_type: str = "general"

    gross_amount: float = Field(
        gt=0
    )

    currency: str = "USD"

    notes: str = ""

    status: str = "pending"


# =========================================================
# ADMIN SECURITY
# =========================================================

def require_admin(key: str):
    expected = os.getenv(
        "ADMIN_KEY",
        ""
    )

    if not expected:
        raise HTTPException(
            status_code=503,
            detail="admin_key_not_configured"
        )

    if key != expected:
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

    try:
        db.init_tasks()
    except Exception:
        pass

    try:
        db.init_revenue()
    except Exception:
        pass


# =========================================================
# BASIC
# =========================================================

@app.get("/")
def home():

    return {
        "project": "3Migo Coin",
        "version": APP_VERSION,
        "status": "online",
        "token": "3M",
        "max_supply_draft": 3000000000,
        "mining_cycle_hours": MINING_CYCLE_HOURS,
        "mining_reward": MINING_REWARD,
        "revenue_engine": "3.0",
        "admin_dashboard": "3.1"
    }


@app.get("/health")
def health():

    return {
        "status": "ok",
        "service": "3Migo Coin API",
        "version": APP_VERSION
    }


@app.get("/miniapp")
def miniapp():

    return {
        "project": "3Migo Coin",
        "webapp": "/webapp/index.html",
        "version": APP_VERSION
    }


# =========================================================
# ADMIN DASHBOARD ENTRY
# =========================================================

@app.get(
    "/admin",
    response_class=HTMLResponse
)
def admin_home():

    return """
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport"
              content="width=device-width, initial-scale=1.0">

        <title>3Migo Smart Admin</title>

        <style>
            body {
                margin: 0;
                background: #07111f;
                color: #ffffff;
                font-family: Arial, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                text-align: center;
            }

            .box {
                width: 90%;
                max-width: 520px;
                background: #0d1b2e;
                border: 1px solid #1f3b5d;
                border-radius: 20px;
                padding: 30px;
                box-sizing: border-box;
            }

            .logo {
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 10px;
            }

            .logo span {
                color: #f5c542;
            }

            h1 {
                margin: 10px 0;
            }

            p {
                color: #aebed0;
                line-height: 1.7;
            }

            .status {
                display: inline-block;
                padding: 8px 16px;
                border-radius: 20px;
                background: #123c2c;
                color: #58d68d;
                margin: 15px 0;
            }

            .version {
                color: #7f9bb8;
                font-size: 13px;
            }
        </style>
    </head>

    <body>

        <div class="box">

            <div class="logo">
                3<span>Migo</span> Smart
            </div>

            <h1>لوحة الإدارة</h1>

            <div class="status">
                ● النظام متصل
            </div>

            <p>
                تم تشغيل أساس لوحة الإدارة بنجاح.
                سيتم ربط لوحة المؤشرات والإيرادات
                والخزانة والمستخدمين في المرحلة التالية.
            </p>

            <div class="version">
                Admin Dashboard v3.1.0
            </div>

        </div>

    </body>
    </html>
    """


# =========================================================
# USERS
# =========================================================

@app.post("/register")
def register(data: Register):

    result = db.create_user(
        data.telegram_id,
        data.username,
        data.referral_code
    )

    return result[0]


@app.get("/user/{telegram_id}")
def user(telegram_id: int):

    u = db.get_user(
        telegram_id
    )

    return u or {
        "error": "user_not_found"
    }


# =========================================================
# DAILY REWARD
# =========================================================

@app.post("/daily/{telegram_id}")
def daily(telegram_id: int):

    u, status = db.claim_daily(
        telegram_id
    )

    if status == "user_not_found":

        return {
            "error": status
        }

    if status == "already_claimed":

        return {
            "error": status,
            "user": u
        }

    return u


@app.post("/user/{telegram_id}/daily")
def daily_legacy(telegram_id: int):

    return daily(
        telegram_id
    )


# =========================================================
# MINING
# =========================================================

@app.get("/mining/{telegram_id}/status")
def mining_status(telegram_id: int):

    user_data = db.get_user(
        telegram_id
    )

    if not user_data:

        return {
            "error": "user_not_found"
        }

    return db.mining_status(
        telegram_id
    )


@app.post("/mining/{telegram_id}/start")
def start_mining(telegram_id: int):

    user_data = db.get_user(
        telegram_id
    )

    if not user_data:

        return {
            "error": "user_not_found"
        }

    return db.start_mining(
        telegram_id
    )


@app.post("/mining/{telegram_id}/claim")
def claim_mining(telegram_id: int):

    user_data = db.get_user(
        telegram_id
    )

    if not user_data:

        return {
            "error": "user_not_found"
        }

    return db.claim_mining(
        telegram_id
    )


@app.post("/user/{telegram_id}/mine")
def mine_legacy(telegram_id: int):

    user_data = db.get_user(
        telegram_id
    )

    if not user_data:

        return {
            "error": "user_not_found"
        }

    return db.start_mining(
        telegram_id
    )


# =========================================================
# TRANSACTIONS
# =========================================================

@app.get("/transactions/{telegram_id}")
def user_transactions(
    telegram_id: int
):

    return db.transactions(
        telegram_id
    )


# =========================================================
# TASKS
# =========================================================

@app.get("/tasks")
def tasks():

    try:

        rows = db.get_tasks()

        return [
            dict(row)
            for row in rows
        ]

    except Exception:

        connection = db.get_conn()

        try:

            rows = connection.execute(
                """
                SELECT
                    id,
                    title,
                    description,
                    reward_3m,
                    task_type,
                    task_url
                FROM tasks
                WHERE active=1
                ORDER BY id
                """
            ).fetchall()

            return [
                dict(row)
                for row in rows
            ]

        finally:

            connection.close()


@app.get("/tasks/{telegram_id}")
def user_tasks(
    telegram_id: int
):

    try:

        return db.user_tasks(
            telegram_id
        )

    except Exception:

        connection = db.get_conn()

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
                        WHEN ut.id IS NULL
                        THEN 0
                        ELSE 1
                    END AS completed
                FROM tasks t
                LEFT JOIN user_tasks ut
                    ON ut.task_id=t.id
                    AND ut.telegram_id=?
                WHERE t.active=1
                ORDER BY t.id
                """,
                (telegram_id,)
            ).fetchall()

            return [
                dict(row)
                for row in rows
            ]

        finally:

            connection.close()


@app.post(
    "/tasks/{telegram_id}/complete/{task_id}"
)
def complete_task(
    telegram_id: int,
    task_id: int
):

    user_data = db.get_user(
        telegram_id
    )

    if not user_data:

        return {
            "error": "user_not_found"
        }

    connection = db.get_conn()

    try:

        task = connection.execute(
            """
            SELECT *
            FROM tasks
            WHERE id=?
            AND active=1
            """,
            (task_id,)
        ).fetchone()

    finally:

        connection.close()

    if not task:

        return {
            "error": "task_not_found"
        }

    result = db.complete_task(
        telegram_id,
        task_id
    )

    updated_user = result[0]
    status = result[1]

    if status != "completed":

        return {
            "status": status,
            "user": updated_user
        }

    return {
        "status": "completed",
        "task_id": task_id,
        "reward_3m": float(
            task["reward_3m"]
        ),
        "user": updated_user
    }


# =========================================================
# REFERRAL
# =========================================================

@app.get("/referral/{telegram_id}")
def referral(
    telegram_id: int
):

    try:

        return db.referral_stats(
            telegram_id
        )

    except Exception:

        user_data = db.get_user(
            telegram_id
        )

        if not user_data:

            return {
                "error": "user_not_found"
            }

        referral_code = (
            user_data.get("referral_code")
            or f"3M{telegram_id}"
        )

        return {
            "telegram_id": telegram_id,
            "referral_code": referral_code,
            "referral_count": 0,
            "referral_rewards": 0.0
        }


@app.post("/referral/{telegram_id}")
def referral_register(
    telegram_id: int,
    data: ReferralIn
):

    if not data.referral_code:

        return {
            "error": "referral_code_required"
        }

    try:

        return db.process_referral(
            telegram_id,
            data.referral_code
        )

    except Exception:

        return {
            "error": "referral_processing_unavailable"
        }


# =========================================================
# REVENUE ENGINE 3.0
# =========================================================

@app.post("/admin/revenue")
def create_revenue(
    data: RevenueIn,
    x_admin_key: str = Header(
        default=""
    )
):

    require_admin(
        x_admin_key
    )

    allowed_statuses = {
        "pending",
        "confirmed",
        "cancelled"
    }

    if data.status not in allowed_statuses:

        raise HTTPException(
            status_code=400,
            detail="invalid_revenue_status"
        )

    revenue_id = db.add_revenue(
        source=data.source,
        campaign_id=data.campaign_id,
        ad_type=data.ad_type,
        gross_amount=data.gross_amount,
        currency=data.currency,
        notes=data.notes,
        status=data.status
    )

    allocation = db.allocate_revenue(
        revenue_id
    )

    return {
        "status": "success",
        "revenue_id": revenue_id,
        "revenue": allocation
    }


@app.get("/admin/revenue")
def admin_revenue(
    x_admin_key: str = Header(
        default=""
    )
):

    require_admin(
        x_admin_key
    )

    return db.all_revenue()


@app.get("/admin/revenue/summary")
def admin_revenue_summary(
    x_admin_key: str = Header(
        default=""
    )
):

    require_admin(
        x_admin_key
    )

    return db.revenue_summary()


@app.get("/admin/revenue/today")
def admin_revenue_today(
    x_admin_key: str = Header(
        default=""
    )
):

    require_admin(
        x_admin_key
    )

    return {
        "revenue_today_usd":
            db.revenue_today()
    }


@app.get("/admin/revenue/month")
def admin_revenue_month(
    x_admin_key: str = Header(
        default=""
    )
):

    require_admin(
        x_admin_key
    )

    return {
        "revenue_month_usd":
            db.revenue_month()
    }


@app.post(
    "/admin/revenue/{revenue_id}/confirm"
)
def confirm_admin_revenue(
    revenue_id: int,
    x_admin_key: str = Header(
        default=""
    )
):

    require_admin(
        x_admin_key
    )

    revenue, status = db.confirm_revenue(
        revenue_id
    )

    return {
        "status": status,
        "revenue": revenue
    }


@app.post(
    "/admin/revenue/{revenue_id}/cancel"
)
def cancel_admin_revenue(
    revenue_id: int,
    x_admin_key: str = Header(
        default=""
    )
):

    require_admin(
        x_admin_key
    )

    revenue, status = db.cancel_revenue(
        revenue_id
    )

    return {
        "status": status,
        "revenue": revenue
    }


# =========================================================
# ADMIN STATISTICS
# =========================================================

@app.get("/admin/stats")
def admin_stats(
    x_admin_key: str = Header(
        default=""
    )
):

    require_admin(
        x_admin_key
    )

    return db.stats()


# =========================================================
# ADMIN TREASURY
# =========================================================

@app.get("/admin/treasury")
def treasury(
    x_admin_key: str = Header(
        default=""
    )
):

    require_admin(
        x_admin_key
    )

    connection = db.get_conn()

    try:

        table_exists = connection.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type='table'
            AND name='treasury'
            """
        ).fetchone()

        if not table_exists:

            return []

        rows = connection.execute(
            """
            SELECT
                category,
                currency,
                ROUND(
                    SUM(amount),
                    8
                ) AS amount
            FROM treasury
            GROUP BY
                category,
                currency
            ORDER BY category
            """
        ).fetchall()

        return [
            dict(row)
            for row in rows
        ]

    finally:

        connection.close()


# =========================================================
# ADMIN DASHBOARD DATA
# =========================================================

@app.get("/admin/dashboard")
def admin_dashboard(
    x_admin_key: str = Header(
        default=""
    )
):

    require_admin(
        x_admin_key
    )

    result = {
        "project": "3Migo Coin",
        "version": APP_VERSION,
        "status": "online",
        "mining": {
            "cycle_hours": MINING_CYCLE_HOURS,
            "reward": MINING_REWARD
        },
        "revenue_engine": {},
        "treasury": [],
        "stats": {}
    }

    # Revenue summary
    try:
        result["revenue_engine"] = (
            db.revenue_summary()
        )
    except Exception:
        result["revenue_engine"] = {
            "status": "unavailable"
        }

    # Treasury
    try:

        connection = db.get_conn()

        try:

            table_exists = connection.execute(
                """
                SELECT name
                FROM sqlite_master
                WHERE type='table'
                AND name='treasury'
                """
            ).fetchone()

            if table_exists:

                rows = connection.execute(
                    """
                    SELECT
                        category,
                        currency,
                        ROUND(
                            SUM(amount),
                            8
                        ) AS amount
                    FROM treasury
                    GROUP BY
                        category,
                        currency
                    ORDER BY category
                    """
                ).fetchall()

                result["treasury"] = [
                    dict(row)
                    for row in rows
                ]

        finally:

            connection.close()

    except Exception:

        result["treasury"] = []

    # General statistics
    try:
        result["stats"] = db.stats()
    except Exception:
        result["stats"] = {
            "status": "unavailable"
        }

    return result


# =========================================================
# ADMIN SYSTEM STATUS
# =========================================================

@app.get("/admin/status")
def admin_status(
    x_admin_key: str = Header(
        default=""
    )
):

    require_admin(
        x_admin_key
    )

    return {
        "status": "online",
        "project": "3Migo Coin",
        "api_version": APP_VERSION,
        "revenue_engine": "3.0",
        "admin_dashboard": "3.1",
        "mining_cycle_hours": MINING_CYCLE_HOURS,
        "mining_reward": MINING_REWARD
    }
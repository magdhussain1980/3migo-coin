import os
from fastapi import FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import db
from pydantic import BaseModel, Field
import db

app = FastAPI(title="3Migo Coin", version="1.1.0")
# =========================
# 3Migo Mini App
# =========================

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
class Register(BaseModel):
    telegram_id: int
    username: str = ""
    referral_code: str = ""

class RevenueIn(BaseModel):
    source: str = Field(pattern="^(telegram_ads|direct_ads|affiliate|tasks|partnership)$")
    campaign_id: str = ""
    gross_amount: float = Field(gt=0)
    currency: str = "USD"
    notes: str = ""
    status: str = "confirmed"

def require_admin(key):
    expected=os.getenv("ADMIN_KEY","")
    if not expected or key != expected:
        raise HTTPException(status_code=401, detail="invalid_admin_key")

@app.on_event("startup")
def startup():
    db.init_db()

@app.get("/")
def home():
    return {"project":"3Migo Coin","version":"1.1.0","status":"prototype","token":"3M","max_supply_draft":3000000000}

@app.get("/health")
def health():
    return {"status":"ok"}

@app.post("/register")
def register(data:Register):
    return db.create_user(data.telegram_id,data.username,data.referral_code)[0]

@app.get("/user/{telegram_id}")
def user(telegram_id:int):
    u=db.get_user(telegram_id)
    return u or {"error":"user_not_found"}

@app.post("/user/{telegram_id}/daily")
def daily(telegram_id:int):
    u,status=db.claim_daily(telegram_id)
    if status=="user_not_found": return {"error":status}
    if status=="already_claimed": return {"error":status,"user":u}
    return u

@app.post("/user/{telegram_id}/mine")
def mine(telegram_id:int):
    u=db.get_user(telegram_id)
    if not u: return {"error":"user_not_found"}
    return db.credit(telegram_id,10,"engagement_reward","proof_of_engagement")

@app.get("/transactions/{telegram_id}")
def user_transactions(telegram_id:int):
    return db.transactions(telegram_id)

@app.get("/tasks")
def tasks():
    c=db.conn(); rows=c.execute("SELECT id,title,reward_3m,active FROM tasks WHERE active=1").fetchall(); c.close()
    return [dict(x) for x in rows]

@app.get("/admin/stats")
def admin_stats(x_admin_key:str=Header(default="")):
    require_admin(x_admin_key)
    return db.stats()

@app.get("/admin/revenue")
def admin_revenue(x_admin_key:str=Header(default="")):
    require_admin(x_admin_key)
    return db.all_revenue()

@app.post("/admin/revenue")
def create_revenue(data:RevenueIn,x_admin_key:str=Header(default="")):
    require_admin(x_admin_key)
    rid=db.add_revenue(data.source,data.campaign_id,data.gross_amount,data.currency,data.notes,data.status)
    allocations=db.allocate_revenue(rid,float(os.getenv("REWARD_POOL_SHARE","0.40")))
    return {"revenue_id":rid,"allocations":allocations}

@app.get("/admin/treasury")
def treasury(x_admin_key:str=Header(default="")):
    require_admin(x_admin_key)
    c=db.conn(); rows=c.execute("""SELECT category, currency, ROUND(SUM(amount),2) amount
                                  FROM treasury GROUP BY category,currency ORDER BY category""").fetchall(); c.close()
    return [dict(x) for x in rows]

@app.get("/referral/{telegram_id}")
def referral_info(telegram_id: int):
    user = db.get_user(telegram_id)

    if not user:
        return {"error": "user_not_found"}

    conn = db.get_conn()

    try:
        # عدد الأشخاص الذين سجلوا باستخدام كود الإحالة
        row = conn.execute("""
            SELECT COUNT(*) AS count
            FROM users
            WHERE referred_by=?
        """, (user["referral_code"],)).fetchone()

        referral_count = row["count"] if row else 0

        # إجمالي مكافآت الإحالة
        row = conn.execute("""
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM transactions
            WHERE telegram_id=?
              AND transaction_type='referral_reward'
        """, (telegram_id,)).fetchone()

        referral_rewards = row["total"] if row else 0

        return {
            "telegram_id": telegram_id,
            "referral_code": user["referral_code"],
            "referral_count": referral_count,
            "referral_rewards": referral_rewards
        }

    finally:
        conn.close()


@app.post("/referral/{telegram_id}")
def apply_referral_api(
    telegram_id: int,
    referral_code: str
):
    result, status = db.apply_referral(
        telegram_id,
        referral_code
    )

    if status != "referral_applied":
        return {
            "status": status,
            "user": dict(result) if result else None
        }

    return {
        "status": status,
        "user": dict(result),
        "reward": 25
    }
# =========================================================
# 3MIGO COIN — TASK API
# =========================================================

@app.get("/tasks/{telegram_id}")
def tasks_for_user(telegram_id: int):
    """
    إرجاع المهام النشطة وحالة إنجاز المستخدم.
    """

    # التأكد من وجود المستخدم
    db.get_user(telegram_id)

    return db.get_tasks(telegram_id)


@app.post("/tasks/{telegram_id}/complete/{task_id}")
def complete_user_task(
    telegram_id: int,
    task_id: int
):
    """
    إكمال مهمة ومنح المكافأة.
    """

    user, status = db.complete_task(
        telegram_id,
        task_id
    )

    if status == "completed":
        return {
            "status": "completed",
            "reward": 0,
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
        "user": dict(user) if user else None
    }
# =========================================================
# 3MIGO COIN — TASK LIST API
# =========================================================

@app.get("/tasks/{telegram_id}")
def tasks_for_user(telegram_id: int):
    """
    إرجاع قائمة المهام للمستخدم.
    """

    # التأكد من وجود المستخدم
    db.get_user(telegram_id)

    tasks = db.get_tasks(telegram_id)

    return tasks
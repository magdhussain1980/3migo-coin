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

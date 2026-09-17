from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime, date
from typing import Dict, List
import os, secrets

app = FastAPI(title="3Maigo Bot V1.0")

users: Dict[int, dict] = {}
transactions: List[dict] = []
tasks: Dict[int, dict] = {
    1: {"title": "Welcome to 3Maigo", "reward": 100, "active": True},
}

class Register(BaseModel):
    telegram_id: int
    username: str = ""
    referral_code: str = ""

def tx(uid, kind, amount, source):
    item = {
        "id": len(transactions)+1, "user_id": uid, "type": kind,
        "amount_3m": amount, "source": source,
        "created_at": datetime.utcnow().isoformat()
    }
    transactions.append(item)
    users[uid]["balance_3m"] += amount
    return item

@app.get("/")
def home():
    return {"project":"3Maigo","version":"V1.0","status":"prototype"}

@app.post("/register")
def register(data: Register):
    if data.telegram_id in users:
        return users[data.telegram_id]
    code = secrets.token_urlsafe(6)
    users[data.telegram_id] = {
        "telegram_id": data.telegram_id,
        "username": data.username,
        "referral_code": code,
        "referred_by": data.referral_code,
        "balance_3m": 0,
        "created_at": datetime.utcnow().isoformat(),
        "last_daily": None
    }
    tx(data.telegram_id, "signup_bonus", 100, "registration")
    return users[data.telegram_id]

@app.get("/user/{telegram_id}")
def user(telegram_id: int):
    return users.get(telegram_id, {"error":"user_not_found"})

@app.post("/user/{telegram_id}/daily")
def daily(telegram_id: int):
    if telegram_id not in users:
        return {"error":"user_not_found"}
    today = str(date.today())
    if users[telegram_id]["last_daily"] == today:
        return {"error":"daily_reward_already_claimed"}
    users[telegram_id]["last_daily"] = today
    return tx(telegram_id, "daily_reward", 50, "daily")

@app.post("/user/{telegram_id}/mine")
def mine(telegram_id: int):
    if telegram_id not in users:
        return {"error":"user_not_found"}
    return tx(telegram_id, "engagement_reward", 10, "proof_of_engagement")

@app.get("/tasks")
def get_tasks():
    return list(tasks.values())

@app.get("/transactions/{telegram_id}")
def get_transactions(telegram_id: int):
    return [t for t in transactions if t["user_id"] == telegram_id]

@app.get("/admin/stats")
def stats():
    return {
        "users": len(users),
        "total_3m_distributed": sum(t["amount_3m"] for t in transactions),
        "transactions": len(transactions),
        "revenue_usd": 0,
        "treasury_usd": 0
    }

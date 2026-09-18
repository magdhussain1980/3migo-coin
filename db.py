import os, sqlite3
from datetime import datetime, date
from pathlib import Path

DB_PATH = os.getenv("DATABASE_PATH", "3migo.db")

def conn():
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    c = conn()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      username TEXT DEFAULT '',
      referral_code TEXT UNIQUE NOT NULL,
      referred_by TEXT DEFAULT '',
      balance_3m REAL NOT NULL DEFAULT 0,
      last_daily TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount_3m REAL NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS revenue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      campaign_id TEXT DEFAULT '',
      gross_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS treasury (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      revenue_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      reward_3m REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    """)
    if c.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] == 0:
        c.execute("INSERT INTO tasks(title,reward_3m,active) VALUES(?,?,1)",
                  ("Welcome to 3Migo", 100))
    c.commit(); c.close()

def now():
    return datetime.utcnow().isoformat(timespec="seconds")

def get_user(uid):
    c=conn(); r=c.execute("SELECT * FROM users WHERE telegram_id=?", (uid,)).fetchone(); c.close()
    return dict(r) if r else None

def get_user_by_ref(code):
    c=conn(); r=c.execute("SELECT * FROM users WHERE referral_code=?", (code,)).fetchone(); c.close()
    return dict(r) if r else None

def create_user(uid, username="", referred_by=""):
    import secrets
    if get_user(uid): return get_user(uid), False
    code="3M-"+secrets.token_urlsafe(6).replace("-","").replace("_","")[:8].upper()
    c=conn()
    c.execute("""INSERT INTO users(telegram_id,username,referral_code,referred_by,created_at)
                 VALUES(?,?,?,?,?)""",(uid,username or "",code,referred_by or "",now()))
    c.execute("""INSERT INTO transactions(user_id,type,amount_3m,source,created_at)
                 VALUES(?,?,?,?,?)""",(uid,"signup_bonus",100,"registration",now()))
    c.execute("UPDATE users SET balance_3m=balance_3m+100 WHERE telegram_id=?",(uid,))
    c.commit(); c.close()
    return get_user(uid), True

def credit(uid, amount, kind, source):
    c=conn()
    c.execute("UPDATE users SET balance_3m=balance_3m+? WHERE telegram_id=?",(amount,uid))
    if c.rowcount==0: c.close(); return None
    c.execute("""INSERT INTO transactions(user_id,type,amount_3m,source,created_at)
                 VALUES(?,?,?,?,?)""",(uid,kind,amount,source,now()))
    c.commit(); c.close()
    return get_user(uid)

def claim_daily(uid):
    u=get_user(uid)
    if not u: return None, "user_not_found"
    today=str(date.today())
    if u["last_daily"]==today: return u, "already_claimed"
    c=conn()
    c.execute("UPDATE users SET last_daily=? , balance_3m=balance_3m+50 WHERE telegram_id=?",(today,uid))
    c.execute("""INSERT INTO transactions(user_id,type,amount_3m,source,created_at)
                 VALUES(?,?,?,?,?)""",(uid,"daily_reward",50,"daily",now()))
    c.commit(); c.close()
    return get_user(uid), "ok"

def add_revenue(source,campaign_id,gross,currency="USD",notes="",status="confirmed"):
    c=conn()
    cur=c.execute("""INSERT INTO revenue(source,campaign_id,gross_amount,currency,notes,status,created_at)
                     VALUES(?,?,?,?,?,?,?)""",
                  (source,campaign_id,gross,currency,notes,status,now()))
    rid=cur.lastrowid
    c.commit(); c.close()
    return rid

def allocate_revenue(revenue_id, reward_share=0.40):
    c=conn()
    r=c.execute("SELECT * FROM revenue WHERE id=?",(revenue_id,)).fetchone()
    if not r: c.close(); return None
    existing=c.execute("SELECT COUNT(*) FROM treasury WHERE revenue_id=?",(revenue_id,)).fetchone()[0]
    if existing: 
        rows=c.execute("SELECT * FROM treasury WHERE revenue_id=?",(revenue_id,)).fetchall()
        c.close(); return [dict(x) for x in rows]
    gross=float(r["gross_amount"])
    allocations={
      "user_rewards": gross*reward_share,
      "treasury_reserve": gross*0.25,
      "development": gross*0.15,
      "liquidity": gross*0.10,
      "marketing": gross*0.10
    }
    for cat,amt in allocations.items():
        c.execute("""INSERT INTO treasury(revenue_id,category,amount,currency,created_at)
                     VALUES(?,?,?,?,?)""",(revenue_id,cat,amt,r["currency"],now()))
    c.commit()
    rows=c.execute("SELECT * FROM treasury WHERE revenue_id=?",(revenue_id,)).fetchall()
    c.close(); return [dict(x) for x in rows]

def stats():
    c=conn()
    users=c.execute("SELECT COUNT(*) n FROM users").fetchone()["n"]
    distributed=c.execute("SELECT COALESCE(SUM(amount_3m),0) s FROM transactions").fetchone()["s"]
    revenue=c.execute("SELECT COALESCE(SUM(gross_amount),0) s FROM revenue WHERE status='confirmed' AND currency='USD'").fetchone()["s"]
    treasury=c.execute("SELECT COALESCE(SUM(amount),0) s FROM treasury WHERE currency='USD'").fetchone()["s"]
    by_source=c.execute("""SELECT source, COALESCE(SUM(gross_amount),0) total
                           FROM revenue WHERE status='confirmed' GROUP BY source ORDER BY total DESC""").fetchall()
    c.close()
    return {"users":users,"total_3m_distributed":distributed,"confirmed_revenue_usd":revenue,
            "treasury_allocated_usd":treasury,"revenue_by_source":[dict(x) for x in by_source]}

def transactions(uid):
    c=conn(); rows=c.execute("SELECT * FROM transactions WHERE user_id=? ORDER BY id DESC",(uid,)).fetchall(); c.close()
    return [dict(x) for x in rows]

def all_revenue():
    c=conn(); rows=c.execute("SELECT * FROM revenue ORDER BY id DESC").fetchall(); c.close()
    return [dict(x) for x in rows]

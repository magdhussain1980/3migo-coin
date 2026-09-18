import os, threading, time
import uvicorn
import db
from bot import run as run_bot

def run_api():
    uvicorn.run("app:app",host="0.0.0.0",port=int(os.getenv("PORT","10000")),log_level="info")

if __name__=="__main__":
    db.init_db()
    t=threading.Thread(target=run_api,daemon=True)
    t.start()
    time.sleep(2)
    run_bot()

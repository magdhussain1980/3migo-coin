import os
import threading
import time
import asyncio
import uvicorn
import db
from bot import run as run_bot

def run_api():
    port = int(os.getenv("PORT", "10000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="info")

async def start_all():
    db.init_db()
    
    t = threading.Thread(target=run_api, daemon=True)
    t.start()
    
    await asyncio.sleep(2)
    
    print("جاري تشغيل البوت والخدمات بنجاح...")
    await run_bot()

if __name__ == "__main__":
    asyncio.run(start_all())

import os
import threading
import asyncio
import uvicorn

import db
from bot import run as run_bot


# =========================================================
# 3MIGO COIN — MAIN RUNNER
# API + TELEGRAM BOT
# =========================================================

PORT = int(os.getenv("PORT", "10000"))


def run_api():
    """
    Start FastAPI / Uvicorn on Render's assigned port.
    """
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=PORT,
        log_level="info",
        access_log=True,
    )


async def start_bot():
    """
    Start Telegram bot inside the main asyncio event loop.
    """
    print("Starting Telegram bot...")

    try:
        await run_bot()
    except Exception as error:
        print(f"Telegram bot stopped: {error}")
        raise


async def start_all():
    """
    Start API immediately, then start Telegram bot.
    """

    print("=" * 60)
    print("3Migo Coin — Starting Services")
    print("=" * 60)

    # Initialize database
    try:
        db.init_db()
        print("Database initialized.")
    except Exception as error:
        print(f"Database initialization error: {error}")
        raise

    # Start FastAPI immediately
    api_thread = threading.Thread(
        target=run_api,
        name="3MigoAPI",
        daemon=True,
    )

    api_thread.start()

    print(f"FastAPI starting on port {PORT}...")

    # Give Uvicorn a short time to bind the port
    await asyncio.sleep(1)

    # Start Telegram
    print("Starting Telegram polling...")

    await start_bot()


if __name__ == "__main__":
    try:
        asyncio.run(start_all())

    except KeyboardInterrupt:
        print("3Migo Coin stopped.")

    except Exception as error:
        print(f"3Migo Coin startup error: {error}")
        raise
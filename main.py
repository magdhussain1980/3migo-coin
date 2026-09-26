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

# =========================================================
# TELEGRAM REVENUE DIAGNOSTIC
# Set to "true" in Render Environment to run once at startup.
# After reading the result, change it back to "false".
# =========================================================

RUN_REVENUE_DIAGNOSTIC = (
    os.getenv(
        "RUN_TELEGRAM_REVENUE_DIAGNOSTIC",
        "false"
    ).lower()
    == "true"
)


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


async def run_revenue_diagnostic_once():
    """
    Run Telegram revenue diagnostic once.

    READ-ONLY:
    - No withdrawal
    - No economy changes
    - No database changes
    """

    try:

        from telegram_revenue import check_revenue

        print("=" * 60)
        print("3MIGO — TELEGRAM REVENUE DIAGNOSTIC")
        print("READ-ONLY / NO WITHDRAWAL")
        print("=" * 60)

        await check_revenue()

        print("=" * 60)
        print("3MIGO — REVENUE DIAGNOSTIC FINISHED")
        print("=" * 60)

    except Exception as error:

        print("=" * 60)
        print("3MIGO — REVENUE DIAGNOSTIC ERROR")
        print("=" * 60)
        print(
            f"{type(error).__name__}: {error}"
        )


async def start_bot():
    """
    Start Telegram bot inside the main asyncio event loop.
    """

    print("Starting Telegram bot...")

    try:

        await run_bot()

    except Exception as error:

        print(
            f"Telegram bot stopped: {error}"
        )

        raise


async def start_all():
    """
    Start API immediately, optionally run the
    read-only revenue diagnostic, then start Telegram bot.
    """

    print("=" * 60)
    print("3Migo Coin — Starting Services")
    print("=" * 60)

    # =====================================================
    # Initialize database
    # =====================================================

    try:

        db.init_db()

        print(
            "Database initialized."
        )

    except Exception as error:

        print(
            f"Database initialization error: {error}"
        )

        raise

    # =====================================================
    # Start FastAPI
    # =====================================================

    api_thread = threading.Thread(
        target=run_api,
        name="3MigoAPI",
        daemon=True,
    )

    api_thread.start()

    print(
        f"FastAPI starting on port {PORT}..."
    )

    # =====================================================
    # Give Uvicorn time to bind the port
    # =====================================================

    await asyncio.sleep(1)

    # =====================================================
    # Optional Telegram revenue diagnostic
    # =====================================================

    if RUN_REVENUE_DIAGNOSTIC:

        print(
            "\nRevenue diagnostic mode ENABLED."
        )

        # Run as a background task so the main bot
        # is not blocked.
        asyncio.create_task(
            run_revenue_diagnostic_once()
        )

    else:

        print(
            "\nRevenue diagnostic mode disabled."
        )

    # =====================================================
    # Start Telegram bot
    # =====================================================

    print(
        "Starting Telegram polling..."
    )

    await start_bot()


# =========================================================
# ENTRY POINT
# =========================================================

if __name__ == "__main__":

    try:

        asyncio.run(
            start_all()
        )

    except KeyboardInterrupt:

        print(
            "3Migo Coin stopped."
        )

    except Exception as error:

        print(
            f"3Migo Coin startup error: {error}"
        )

        raise
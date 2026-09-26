# =========================================================
# 3MIGO TELEGRAM REVENUE DIAGNOSTIC
# READ-ONLY
# NO WITHDRAWAL
# =========================================================

import os
import asyncio
import json

from telethon import TelegramClient, functions


API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")
BOT_TOKEN = os.getenv("BOT_TOKEN")


async def check_revenue():

    print("=" * 60)
    print("3MIGO TELEGRAM REVENUE DIAGNOSTIC")
    print("=" * 60)

    # -----------------------------------------------------
    # Environment validation
    # -----------------------------------------------------

    if not API_ID:
        print("ERROR: TELEGRAM_API_ID is missing")
        return

    if not API_HASH:
        print("ERROR: TELEGRAM_API_HASH is missing")
        return

    if not BOT_TOKEN:
        print("ERROR: BOT_TOKEN is missing")
        return

    try:
        api_id = int(API_ID)
    except ValueError:
        print("ERROR: TELEGRAM_API_ID must be numeric")
        return

    # -----------------------------------------------------
    # Telegram connection
    # -----------------------------------------------------

    client = TelegramClient(
        "3migo_revenue_diagnostic",
        api_id,
        API_HASH
    )

    try:

        print("\n[1] Connecting to Telegram...")

        await client.start(
            bot_token=BOT_TOKEN
        )

        print("OK: Telegram connection established")

        # -------------------------------------------------
        # Bot information
        # -------------------------------------------------

        me = await client.get_me()

        print("\n[2] Bot information")

        bot_info = {
            "id": getattr(me, "id", None),
            "username": getattr(me, "username", None),
            "first_name": getattr(me, "first_name", None),
            "is_bot": getattr(me, "bot", None)
        }

        print(json.dumps(
            bot_info,
            ensure_ascii=False,
            indent=2
        ))

        # -------------------------------------------------
        # Revenue peer
        # -------------------------------------------------

        print("\n[3] Preparing revenue request...")

        peer = await client.get_input_entity(me)

        # -------------------------------------------------
        # READ-ONLY Telegram Revenue API
        # -------------------------------------------------

        print("[4] Requesting revenue statistics...")

        result = await client(
            functions.stats.GetBroadcastRevenueStatsRequest(
                peer=peer,
                dark=False
            )
        )

        print("\n[5] Telegram response received")

        # -------------------------------------------------
        # Extract balances
        # -------------------------------------------------

        balances = getattr(
            result,
            "balances",
            None
        )

        if balances is None:

            print("\nWARNING: No revenue balances returned.")

            print("\nRAW TELEGRAM RESPONSE:")
            print(result.stringify())

            return

        current_balance = getattr(
            balances,
            "current_balance",
            0
        )

        available_balance = getattr(
            balances,
            "available_balance",
            0
        )

        overall_revenue = getattr(
            balances,
            "overall_revenue",
            0
        )

        withdrawal_enabled = getattr(
            balances,
            "withdrawal_enabled",
            False
        )

        # -------------------------------------------------
        # TON conversion
        # -------------------------------------------------

        TON_NANOGRAMS = 1_000_000_000

        revenue = {

            "current_balance_nanotons":
                current_balance,

            "available_balance_nanotons":
                available_balance,

            "overall_revenue_nanotons":
                overall_revenue,

            "current_balance_ton":
                current_balance / TON_NANOGRAMS,

            "available_balance_ton":
                available_balance / TON_NANOGRAMS,

            "overall_revenue_ton":
                overall_revenue / TON_NANOGRAMS,

            "withdrawal_enabled":
                withdrawal_enabled
        }

        # -------------------------------------------------
        # Final result
        # -------------------------------------------------

        output = {

            "status": "ok",

            "bot": bot_info,

            "telegram_revenue": revenue
        }

        print("\n")
        print("=" * 60)
        print("3MIGO TELEGRAM REVENUE RESULT")
        print("=" * 60)

        print(
            json.dumps(
                output,
                ensure_ascii=False,
                indent=2
            )
        )

        # -------------------------------------------------
        # Human readable status
        # -------------------------------------------------

        print("\n" + "-" * 60)

        if overall_revenue > 0:
            print("REVENUE: DETECTED")
        else:
            print("REVENUE: ZERO")

        if withdrawal_enabled:
            print("WITHDRAWAL: ENABLED")
        else:
            print("WITHDRAWAL: NOT ENABLED")

        print("-" * 60)

    except Exception as error:

        print("\n")
        print("=" * 60)
        print("3MIGO TELEGRAM REVENUE ERROR")
        print("=" * 60)

        print(
            type(error).__name__
        )

        print(
            str(error)
        )

        print("\nNo withdrawal was attempted.")

    finally:

        await client.disconnect()

        print("\nTelegram connection closed.")


if __name__ == "__main__":

    asyncio.run(
        check_revenue()
    )
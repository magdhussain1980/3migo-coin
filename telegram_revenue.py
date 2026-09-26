# =========================================================
# 3MIGO TELEGRAM REVENUE DIAGNOSTIC V2
# OWNER SESSION / READ-ONLY
# NO WITHDRAWAL
# NO ECONOMY CHANGES
# =========================================================

import os
import asyncio
import json

from telethon import TelegramClient, functions


API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")

# Username of the 3Migo bot
BOT_USERNAME = os.getenv(
    "THREEMIGO_BOT_USERNAME",
    "threemigosmart_bot"
)


async def check_revenue():

    print("=" * 70)
    print("3MIGO TELEGRAM REVENUE DIAGNOSTIC V2")
    print("READ-ONLY / NO WITHDRAWAL")
    print("=" * 70)

    # -----------------------------------------------------
    # Environment validation
    # -----------------------------------------------------

    if not API_ID:
        print("ERROR: TELEGRAM_API_ID is missing")
        return

    if not API_HASH:
        print("ERROR: TELEGRAM_API_HASH is missing")
        return

    try:
        api_id = int(API_ID)
    except ValueError:
        print("ERROR: TELEGRAM_API_ID must be numeric")
        return

    # -----------------------------------------------------
    # Owner session
    # -----------------------------------------------------

    client = TelegramClient(
        "3migo_owner_revenue",
        api_id,
        API_HASH
    )

    try:

        print("\n[1] Connecting with Telegram owner session...")

        await client.start()

        print("OK: Owner session connected")

        # -------------------------------------------------
        # Owner information
        # -------------------------------------------------

        owner = await client.get_me()

        owner_info = {
            "id": getattr(owner, "id", None),
            "username": getattr(owner, "username", None),
            "first_name": getattr(owner, "first_name", None),
            "last_name": getattr(owner, "last_name", None)
        }

        print("\n[2] Owner account")

        print(
            json.dumps(
                owner_info,
                ensure_ascii=False,
                indent=2
            )
        )

        # -------------------------------------------------
        # Resolve 3Migo bot
        # -------------------------------------------------

        print("\n[3] Resolving 3Migo bot...")

        bot = await client.get_entity(
            BOT_USERNAME
        )

        bot_info = {
            "id": getattr(bot, "id", None),
            "username": getattr(bot, "username", None),
            "first_name": getattr(bot, "first_name", None),
            "is_bot": getattr(bot, "bot", None)
        }

        print(
            json.dumps(
                bot_info,
                ensure_ascii=False,
                indent=2
            )
        )

        if not getattr(bot, "bot", False):

            print(
                "\nWARNING: Resolved account is not marked as a bot."
            )

            return

        # -------------------------------------------------
        # Input peer
        # -------------------------------------------------

        print("\n[4] Preparing revenue peer...")

        peer = await client.get_input_entity(
            bot
        )

        # -------------------------------------------------
        # Telegram Revenue API
        # -------------------------------------------------

        print(
            "\n[5] Requesting Telegram ad revenue statistics..."
        )

        result = await client(
            functions.payments.GetStarsRevenueStatsRequest(
                dark=False,
                ton=True,
                peer=peer
            )
        )

        print(
            "\n[6] Telegram revenue response received"
        )

        # -------------------------------------------------
        # Revenue status
        # -------------------------------------------------

        status = getattr(
            result,
            "status",
            None
        )

        if status is None:

            print(
                "\nWARNING: Telegram returned no revenue status."
            )

            print("\nRAW RESPONSE:")

            print(
                result.stringify()
            )

            return

        # -------------------------------------------------
        # Extract values
        # -----------------------------------------------------

        current_balance = getattr(
            status,
            "current_balance",
            None
        )

        available_balance = getattr(
            status,
            "available_balance",
            None
        )

        overall_revenue = getattr(
            status,
            "overall_revenue",
            None
        )

        withdrawal_enabled = getattr(
            status,
            "withdrawal_enabled",
            False
        )

        next_withdrawal_at = getattr(
            status,
            "next_withdrawal_at",
            None
        )

        # -------------------------------------------------
        # TON values
        # Telegram returns nanograms
        # 1 TON = 1,000,000,000 nanograms
        # -------------------------------------------------

        TON_NANOGRAMS = 1_000_000_000

        def to_ton(value):

            if value is None:
                return None

            return float(value) / TON_NANOGRAMS

        revenue = {

            "current_balance_nanotons":
                current_balance,

            "available_balance_nanotons":
                available_balance,

            "overall_revenue_nanotons":
                overall_revenue,

            "current_balance_ton":
                to_ton(current_balance),

            "available_balance_ton":
                to_ton(available_balance),

            "overall_revenue_ton":
                to_ton(overall_revenue),

            "withdrawal_enabled":
                withdrawal_enabled,

            "next_withdrawal_at":
                next_withdrawal_at
        }

        # -------------------------------------------------
        # Final result
        # -------------------------------------------------

        output = {

            "status": "ok",

            "owner": owner_info,

            "bot": bot_info,

            "telegram_ad_revenue": revenue

        }

        print("\n")
        print("=" * 70)
        print("3MIGO TELEGRAM REVENUE RESULT")
        print("=" * 70)

        print(
            json.dumps(
                output,
                ensure_ascii=False,
                indent=2
            )
        )

        # -------------------------------------------------
        # Human-readable result
        # -------------------------------------------------

        print("\n" + "-" * 70)

        if overall_revenue is not None:

            if overall_revenue > 0:

                print(
                    "REVENUE: DETECTED"
                )

            else:

                print(
                    "REVENUE: ZERO"
                )

        else:

            print(
                "REVENUE: UNKNOWN"
            )

        if withdrawal_enabled:

            print(
                "WITHDRAWAL: ENABLED"
            )

        else:

            print(
                "WITHDRAWAL: NOT ENABLED"
            )

        print("-" * 70)

        print(
            "\nIMPORTANT: No withdrawal was attempted."
        )

    except Exception as error:

        print("\n")
        print("=" * 70)
        print("3MIGO TELEGRAM REVENUE ERROR")
        print("=" * 70)

        print(
            "ERROR TYPE:"
        )

        print(
            type(error).__name__
        )

        print(
            "\nERROR:"
        )

        print(
            str(error)
        )

        print(
            "\nNo withdrawal was attempted."
        )

    finally:

        await client.disconnect()

        print(
            "\nTelegram connection closed."
        )


if __name__ == "__main__":

    asyncio.run(
        check_revenue()
    )
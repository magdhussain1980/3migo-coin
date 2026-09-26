# =========================================================
# 3MIGO TELEGRAM REVENUE DIAGNOSTIC V3
# OWNER STRING SESSION / READ-ONLY
# NO WITHDRAWAL
# NO ECONOMY CHANGES
# =========================================================

import os
import asyncio
import json

from telethon import TelegramClient, functions
from telethon.sessions import StringSession


# =========================================================
# ENVIRONMENT VARIABLES
# =========================================================

API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")
STRING_SESSION = os.getenv("TELEGRAM_STRING_SESSION")

BOT_USERNAME = os.getenv(
    "THREEMIGO_BOT_USERNAME",
    "threemigosmart_bot"
)


# =========================================================
# HELPERS
# =========================================================

def print_header(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def to_ton(value):
    """
    Telegram monetary values are returned in nanograms.
    1 TON = 1,000,000,000 nanograms.
    """

    if value is None:
        return None

    try:
        return float(value) / 1_000_000_000
    except (TypeError, ValueError):
        return None


# =========================================================
# MAIN REVENUE CHECK
# =========================================================

async def check_revenue():

    print_header(
        "3MIGO TELEGRAM REVENUE DIAGNOSTIC V3"
    )

    print("READ-ONLY / NO WITHDRAWAL")
    print("OWNER STRING SESSION")
    print("NO ECONOMY CHANGES")

    # =====================================================
    # 1. ENVIRONMENT VALIDATION
    # =====================================================

    print("\n[1] Validating environment variables...")

    if not API_ID:
        print("ERROR: TELEGRAM_API_ID is missing")
        return

    if not API_HASH:
        print("ERROR: TELEGRAM_API_HASH is missing")
        return

    if not STRING_SESSION:
        print("ERROR: TELEGRAM_STRING_SESSION is missing")
        return

    try:

        api_id = int(API_ID)

    except ValueError:

        print(
            "ERROR: TELEGRAM_API_ID must be numeric"
        )

        return

    print("OK: TELEGRAM_API_ID found")
    print("OK: TELEGRAM_API_HASH found")
    print("OK: TELEGRAM_STRING_SESSION found")

    # =====================================================
    # 2. CONNECT USING STRING SESSION
    # =====================================================

    client = TelegramClient(
        StringSession(STRING_SESSION),
        api_id,
        API_HASH
    )

    try:

        print(
            "\n[2] Connecting using Telegram owner session..."
        )

        await client.connect()

        if not await client.is_user_authorized():

            print(
                "ERROR: Telegram String Session is not authorized."
            )

            print(
                "Create a new String Session locally and update "
                "TELEGRAM_STRING_SESSION in Render."
            )

            return

        print(
            "OK: Owner session connected"
        )

        # =================================================
        # 3. OWNER INFORMATION
        # =================================================

        print(
            "\n[3] Reading owner account..."
        )

        owner = await client.get_me()

        owner_info = {

            "id":
                getattr(
                    owner,
                    "id",
                    None
                ),

            "username":
                getattr(
                    owner,
                    "username",
                    None
                ),

            "first_name":
                getattr(
                    owner,
                    "first_name",
                    None
                ),

            "last_name":
                getattr(
                    owner,
                    "last_name",
                    None
                )
        }

        print(
            json.dumps(
                owner_info,
                ensure_ascii=False,
                indent=2
            )
        )

        # =================================================
        # 4. RESOLVE 3MIGO BOT
        # =================================================

        print(
            "\n[4] Resolving 3Migo bot..."
        )

        bot = await client.get_entity(
            BOT_USERNAME
        )

        bot_info = {

            "id":
                getattr(
                    bot,
                    "id",
                    None
                ),

            "username":
                getattr(
                    bot,
                    "username",
                    None
                ),

            "first_name":
                getattr(
                    bot,
                    "first_name",
                    None
                ),

            "is_bot":
                getattr(
                    bot,
                    "bot",
                    None
                )
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

        # =================================================
        # 5. PREPARE INPUT PEER
        # =================================================

        print(
            "\n[5] Preparing Telegram revenue peer..."
        )

        peer = await client.get_input_entity(
            bot
        )

        print(
            "OK: Revenue peer prepared"
        )

        # =================================================
        # 6. TELEGRAM REVENUE API
        # =================================================

        print(
            "\n[6] Requesting Telegram revenue statistics..."
        )

        result = await client(
            functions.payments.GetStarsRevenueStatsRequest(
                dark=False,
                ton=True,
                peer=peer
            )
        )

        print(
            "OK: Telegram revenue response received"
        )

        # =================================================
        # 7. REVENUE STATUS
        # =================================================

        status = getattr(
            result,
            "status",
            None
        )

        if status is None:

            print(
                "\nWARNING: Telegram returned no revenue status."
            )

            print(
                "\nRAW RESPONSE:"
            )

            print(
                result.stringify()
            )

            return

        # =================================================
        # 8. EXTRACT REVENUE VALUES
        # =================================================

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

        # =================================================
        # 9. BUILD REVENUE OBJECT
        # =================================================

        revenue = {

            "current_balance_nanotons":
                current_balance,

            "available_balance_nanotons":
                available_balance,

            "overall_revenue_nanotons":
                overall_revenue,

            "current_balance_ton":
                to_ton(
                    current_balance
                ),

            "available_balance_ton":
                to_ton(
                    available_balance
                ),

            "overall_revenue_ton":
                to_ton(
                    overall_revenue
                ),

            "withdrawal_enabled":
                withdrawal_enabled,

            "next_withdrawal_at":
                next_withdrawal_at
        }

        # =================================================
        # 10. FINAL JSON RESULT
        # =================================================

        output = {

            "status":
                "ok",

            "diagnostic_version":
                "3.0",

            "read_only":
                True,

            "withdrawal_attempted":
                False,

            "owner":
                owner_info,

            "bot":
                bot_info,

            "telegram_ad_revenue":
                revenue
        }

        print_header(
            "3MIGO TELEGRAM REVENUE RESULT"
        )

        print(
            json.dumps(
                output,
                ensure_ascii=False,
                indent=2
            )
        )

        # =================================================
        # 11. HUMAN-READABLE RESULT
        # =================================================

        print(
            "\n" + "-" * 70
        )

        if overall_revenue is not None:

            try:

                if float(overall_revenue) > 0:

                    print(
                        "REVENUE: DETECTED"
                    )

                else:

                    print(
                        "REVENUE: ZERO"
                    )

            except (TypeError, ValueError):

                print(
                    "REVENUE: UNKNOWN"
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

        print(
            "-" * 70
        )

        print(
            "\nIMPORTANT:"
        )

        print(
            "No withdrawal was attempted."
        )

        print(
            "No 3Migo economy data was changed."
        )

    # =====================================================
    # ERROR HANDLING
    # =====================================================

    except Exception as error:

        print_header(
            "3MIGO TELEGRAM REVENUE ERROR"
        )

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

    # =====================================================
    # DISCONNECT
    # =====================================================

    finally:

        await client.disconnect()

        print(
            "\nTelegram connection closed."
        )


# =========================================================
# ENTRY POINT
# =========================================================

if __name__ == "__main__":

    asyncio.run(
        check_revenue()
    )
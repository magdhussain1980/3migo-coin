# =========================================================
# 3MIGO TELEGRAM REVENUE DIAGNOSTIC V4
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


def serialize_value(value):
    """
    Convert Telethon objects such as StarsTonAmount
    into JSON-safe Python values.

    This function is READ-ONLY.
    It does not modify Telegram objects.
    """

    if value is None:
        return None

    if isinstance(
        value,
        (str, int, float, bool)
    ):
        return value

    if isinstance(value, bytes):
        return value.hex()

    if isinstance(value, dict):
        return {
            str(key): serialize_value(val)
            for key, val in value.items()
        }

    if isinstance(
        value,
        (list, tuple, set)
    ):
        return [
            serialize_value(item)
            for item in value
        ]

    # -----------------------------------------------------
    # Telethon TLObject
    # -----------------------------------------------------

    try:

        if hasattr(value, "to_dict"):

            data = value.to_dict()

            return serialize_value(data)

    except Exception:
        pass

    # -----------------------------------------------------
    # Fallback for object attributes
    # -----------------------------------------------------

    try:

        attributes = {}

        for key, val in vars(value).items():

            if key.startswith("_"):
                continue

            if callable(val):
                continue

            attributes[key] = serialize_value(val)

        if attributes:
            return attributes

    except Exception:
        pass

    # -----------------------------------------------------
    # Final fallback
    # -----------------------------------------------------

    return str(value)


def extract_nanotons(value):
    """
    Extract a numeric TON amount represented by
    Telegram's StarsTonAmount structure.

    Expected structure normally contains:
        amount
        nanos

    Returns:
        integer nanoton amount
        or None if unavailable.
    """

    if value is None:
        return None

    # -----------------------------------------------------
    # Already numeric
    # -----------------------------------------------------

    if isinstance(value, int):

        return value

    if isinstance(value, float):

        return int(value)

    # -----------------------------------------------------
    # Object attributes
    # -----------------------------------------------------

    amount = getattr(
        value,
        "amount",
        None
    )

    nanos = getattr(
        value,
        "nanos",
        0
    )

    # -----------------------------------------------------
    # Dictionary fallback
    # -----------------------------------------------------

    if amount is None:

        try:

            data = value.to_dict()

            amount = data.get(
                "amount"
            )

            nanos = data.get(
                "nanos",
                0
            )

        except Exception:

            return None

    try:

        amount = int(amount)

        nanos = int(nanos or 0)

        return (
            amount * 1_000_000_000
        ) + nanos

    except (
        TypeError,
        ValueError
    ):

        return None


def to_ton(value):
    """
    Convert Telegram TON monetary values
    into TON.

    Supports both:
    - numeric nanoton values
    - StarsTonAmount objects
    """

    nanotons = extract_nanotons(
        value
    )

    if nanotons is None:
        return None

    try:

        return (
            float(nanotons)
            / 1_000_000_000
        )

    except (
        TypeError,
        ValueError
    ):

        return None


def amount_details(value):
    """
    Return a JSON-safe representation of
    a Telegram monetary amount.
    """

    nanotons = extract_nanotons(
        value
    )

    ton = to_ton(
        value
    )

    return {

        "raw":

            serialize_value(
                value
            ),

        "nanotons":

            nanotons,

        "ton":

            ton
    }


# =========================================================
# MAIN REVENUE CHECK
# =========================================================

async def check_revenue():

    print_header(
        "3MIGO TELEGRAM REVENUE DIAGNOSTIC V4"
    )

    print(
        "READ-ONLY / NO WITHDRAWAL"
    )

    print(
        "OWNER STRING SESSION"
    )

    print(
        "NO ECONOMY CHANGES"
    )

    # =====================================================
    # 1. ENVIRONMENT VALIDATION
    # =====================================================

    print(
        "\n[1] Validating environment variables..."
    )

    if not API_ID:

        print(
            "ERROR: TELEGRAM_API_ID is missing"
        )

        return

    if not API_HASH:

        print(
            "ERROR: TELEGRAM_API_HASH is missing"
        )

        return

    if not STRING_SESSION:

        print(
            "ERROR: TELEGRAM_STRING_SESSION is missing"
        )

        return

    try:

        api_id = int(
            API_ID
        )

    except ValueError:

        print(
            "ERROR: TELEGRAM_API_ID must be numeric"
        )

        return

    print(
        "OK: TELEGRAM_API_ID found"
    )

    print(
        "OK: TELEGRAM_API_HASH found"
    )

    print(
        "OK: TELEGRAM_STRING_SESSION found"
    )

    # =====================================================
    # 2. CONNECT USING STRING SESSION
    # =====================================================

    client = TelegramClient(
        StringSession(
            STRING_SESSION
        ),
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
                "Create a new String Session locally and "
                "update TELEGRAM_STRING_SESSION in Render."
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
                ),

            "is_bot":
                getattr(
                    owner,
                    "bot",
                    False
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

        if not getattr(
            bot,
            "bot",
            False
        ):

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
                "\nRAW TELEGRAM RESPONSE:"
            )

            try:

                print(
                    result.stringify()
                )

            except Exception:

                print(
                    serialize_value(
                        result
                    )
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
        # 9. SAFE REVENUE OBJECT
        # =================================================

        revenue = {

            "current_balance":
                amount_details(
                    current_balance
                ),

            "available_balance":
                amount_details(
                    available_balance
                ),

            "overall_revenue":
                amount_details(
                    overall_revenue
                ),

            "withdrawal_enabled":
                bool(
                    withdrawal_enabled
                ),

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
                "4.0",

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

        overall_ton = to_ton(
            overall_revenue
        )

        available_ton = to_ton(
            available_balance
        )

        current_ton = to_ton(
            current_balance
        )

        if overall_ton is not None:

            if overall_ton > 0:

                print(
                    "REVENUE: DETECTED"
                )

            else:

                print(
                    "REVENUE: ZERO"
                )

            print(
                f"OVERALL REVENUE: {overall_ton:.9f} TON"
            )

        else:

            print(
                "REVENUE: UNKNOWN"
            )

        if current_ton is not None:

            print(
                f"CURRENT BALANCE: {current_ton:.9f} TON"
            )

        else:

            print(
                "CURRENT BALANCE: UNKNOWN"
            )

        if available_ton is not None:

            print(
                f"AVAILABLE BALANCE: {available_ton:.9f} TON"
            )

        else:

            print(
                "AVAILABLE BALANCE: UNKNOWN"
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

        print(
            "No 3Migo economy data was changed."
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
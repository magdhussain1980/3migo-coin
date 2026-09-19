import os
import logging

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
)

import db


# =========================
# Telegram configuration
# =========================

TOKEN = os.getenv("BOT_TOKEN")

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    level=logging.INFO,
)

logger = logging.getLogger("3MigoBot")


# =========================
# Telegram connection test
# =========================

async def telegram_connection_test(application):

    try:
        me = await application.bot.get_me()

        logger.info("========================================")
        logger.info("3Migo Telegram Diagnostic")
        logger.info("BOT_TOKEN configured: %s", bool(TOKEN))
        logger.info("Telegram connection: SUCCESS")
        logger.info("Bot ID: %s", me.id)
        logger.info("Bot username: @%s", me.username)
        logger.info("Bot name: %s", me.first_name)
        logger.info("========================================")

    except Exception as e:

        logger.error("========================================")
        logger.error("3Migo Telegram Diagnostic FAILED")
        logger.error("BOT_TOKEN configured: %s", bool(TOKEN))
        logger.error("Telegram connection error: %s", e)
        logger.error("========================================")

        raise


# =========================
# Keyboard
# =========================

def keyboard():

    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                "⛏️ كسب 3M",
                callback_data="mine"
            ),
            InlineKeyboardButton(
                "🎁 اليومية",
                callback_data="daily"
            )
        ],
        [
            InlineKeyboardButton(
                "💰 رصيدي",
                callback_data="balance"
            ),
            InlineKeyboardButton(
                "👥 الإحالة",
                callback_data="referral"
            )
        ],
    ])


# =========================
# User registration
# =========================

async def ensure_user(update):

    u = update.effective_user
    ref = ""

    if update.message and update.message.text:

        parts = update.message.text.split(
            maxsplit=1
        )

        if len(parts) > 1 and parts[1].startswith("ref_"):

            ref = parts[1][4:]

    return db.create_user(
        u.id,
        u.username or "",
        ref
    )[0]


# =========================
# /start
# =========================

async def start(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    await ensure_user(update)

    await update.message.reply_text(

        "🪙 أهلاً بك في 3Migo Coin (3M)\n\n"

        "هذه نسخة تجريبية. "
        "الرصيد داخلي وغير قابل للتداول حاليًا.\n"

        "المكافآت مرتبطة بنشاط مؤهل "
        "وإيرادات المشروع، وليست وعدًا بسعر ثابت.",

        reply_markup=keyboard()
    )


# =========================
# Buttons
# =========================

async def buttons(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    q = update.callback_query

    await q.answer()

    uid = q.from_user.id

    db.create_user(
        uid,
        q.from_user.username or ""
    )


    # =====================
    # Mine
    # =====================

    if q.data == "mine":

        u = db.credit(
            uid,
            10,
            "engagement_reward",
            "proof_of_engagement"
        )

        await q.edit_message_text(

            f"⛏️ تمت إضافة 10 3M\n\n"
            f"رصيدك: "
            f"{u['balance_3m']:.0f} 3M",

            reply_markup=keyboard()
        )


    # =====================
    # Daily
    # =====================

    elif q.data == "daily":

        u, status = db.claim_daily(uid)

        if status == "already_claimed":

            await q.edit_message_text(

                f"🎁 استلمت مكافأة اليوم مسبقًا.\n\n"
                f"رصيدك: "
                f"{u['balance_3m']:.0f} 3M",

                reply_markup=keyboard()
            )

        else:

            await q.edit_message_text(

                f"🎁 تمت إضافة 50 3M\n\n"
                f"رصيدك: "
                f"{u['balance_3m']:.0f} 3M",

                reply_markup=keyboard()
            )


    # =====================
    # Balance
    # =====================

    elif q.data == "balance":

        u = db.get_user(uid)

        await q.edit_message_text(

            f"💰 رصيدك الحالي: "
            f"{u['balance_3m']:.0f} 3M\n\n"

            f"رمز العملة: 3M",

            reply_markup=keyboard()
        )


    # =====================
    # Referral
    # =====================

    elif q.data == "referral":

        u = db.get_user(uid)

        await q.edit_message_text(

            f"👥 كود الإحالة الخاص بك:\n"
            f"`{u['referral_code']}`\n\n"

            f"رابط الإحالة يُضاف في مرحلة "
            f"Mini App/الإحالات المتقدمة.",

            parse_mode="Markdown",
            reply_markup=keyboard()
        )


# =========================
# Build Telegram application
# =========================

def build_application():

    if not TOKEN:

        logger.error(
            "BOT_TOKEN is missing from Render Environment"
        )

        raise RuntimeError(
            "BOT_TOKEN is missing"
        )


    logger.info(
        "BOT_TOKEN detected. "
        "Building Telegram application..."
    )


    app = (
        Application.builder()
        .token(TOKEN)
        .post_init(telegram_connection_test)
        .build()
    )


    app.add_handler(
        CommandHandler(
            "start",
            start
        )
    )


    app.add_handler(
        CallbackQueryHandler(
            buttons
        )
    )


    return app


# =========================
# Run bot
# =========================

def run():

    logger.info(
        "========================================"
    )

    logger.info(
        "Starting 3Migo Telegram Bot..."
    )

    logger.info(
        "BOT_TOKEN configured: %s",
        bool(TOKEN)
    )

    logger.info(
        "========================================"
    )


    db.init_db()


    try:

        application = build_application()

        logger.info(
            "Starting Telegram polling..."
        )


        application.run_polling(
            drop_pending_updates=True,
            close_loop=False
        )


    except Exception:

        logger.exception(
            "3Migo Telegram Bot crashed"
        )

        raise


# =========================
# Direct execution
# =========================

if __name__ == "__main__":

    run()

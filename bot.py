import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes

TOKEN = os.getenv("BOT_TOKEN")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    kb = [
        [InlineKeyboardButton("⛏️ كسب 3M", callback_data="mine"),
         InlineKeyboardButton("🎁 اليومية", callback_data="daily")],
        [InlineKeyboardButton("💰 رصيدي", callback_data="balance"),
         InlineKeyboardButton("👥 الإحالة", callback_data="referral")]
    ]
    await update.message.reply_text(
        "🪙 أهلاً بك في 3Maigo\n\n"
        "هذه نسخة V1 التجريبية. الرصيد 3M داخلي وغير قابل للتداول حالياً.",
        reply_markup=InlineKeyboardMarkup(kb)
    )

def main():
    if not TOKEN:
        raise RuntimeError("Set BOT_TOKEN in environment")
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.run_polling()

if __name__ == "__main__":
    main()

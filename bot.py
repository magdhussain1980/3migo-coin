import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
import db

TOKEN = os.getenv("BOT_TOKEN")

def keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📱 الحساب", callback_data="account")],
        [InlineKeyboardButton("💰 المحفظة", callback_data="wallet")],
        [InlineKeyboardButton("🔥 المهام", callback_data="tasks")],
        [InlineKeyboardButton("🔗 الإحالة", callback_data="referral")]
    ])

async def ensure_user(update: Update):
    u = update.effective_user
    ref = ""
    if update.message and update.message.text:
        parts = update.message.text.split(maxsplit=1)
        if len(parts) > 1 and parts.startswith("ref_"):
            ref = parts
    return db.create_user(u.id, u.username or "", ref)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await ensure_user(update)
    
    welcome_text = (
        "👋 أهلاً بك في 3Maigo Coin (3M)!\n\n"
        "📈 هذه نسخة تجريبية. الرصيد داخلي وغير قابل للتداول حالياً.\n"
        "🤖 يمكنك مراقبة نشاط مؤشر وإيرادات المشروع وأنت هادئ البال."
    )
    
    keyboard_layout = [
        [
            InlineKeyboardButton("🎁 نظام الإحالة (Referral)", callback_data="referral"),
        ],
        [
            InlineKeyboardButton("📊 القائمة الرئيسية", callback_data="main_menu"),
            InlineKeyboardButton("⚙️ الإعدادات", callback_data="settings")
        ]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard_layout)
    
    if update.message:
        await update.message.reply_text(text=welcome_text, reply_markup=reply_markup)

async def buttons(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    uid = q.from_user.id
    
    if q.data == "referral":
        u = db.get_user(uid)
        await q.edit_message_text(f"🎁 رابط الإحالة الخاص بك 🎁\n{u['referral_link']}")

def build_application():
    if not TOKEN: 
        raise RuntimeError("BOT_TOKEN is missing")
    
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(buttons))
    return app

async def run():
    app = build_application()
    await app.initialize()
    await app.start()
    if app.updater:
        await app.updater.start_polling(drop_pending_updates=True)
    print("Bot started")

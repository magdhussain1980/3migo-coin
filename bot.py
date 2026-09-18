import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
import db

TOKEN = "8272654338:AUEnts2aA6Ki7ueouU_U4E74eICBLh6DoFw"

def keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("⛏️ كسب 3M",callback_data="mine"),
         InlineKeyboardButton("🎁 اليومية",callback_data="daily")],
        [InlineKeyboardButton("💰 رصيدي",callback_data="balance"),
         InlineKeyboardButton("👥 الإحالة",callback_data="referral")],
    ])

async def ensure_user(update):
    u=update.effective_user
    ref=""
    if update.message and update.message.text:
        parts=update.message.text.split(maxsplit=1)
        if len(parts)>1 and parts[1].startswith("ref_"): ref=parts[1][4:]
    return db.create_user(u.id,u.username or "",ref)[0]

async def start(update:Update,context:ContextTypes.DEFAULT_TYPE):
    await ensure_user(update)
    await update.message.reply_text(
        "🪙 أهلاً بك في 3Migo Coin (3M)\\n\\n"
        "هذه نسخة تجريبية. الرصيد داخلي وغير قابل للتداول حاليًا.\\n"
        "المكافآت مرتبطة بنشاط مؤهل وإيرادات المشروع، وليست وعدًا بسعر ثابت.",
        reply_markup=keyboard())

async def buttons(update:Update,context:ContextTypes.DEFAULT_TYPE):
    q=update.callback_query
    await q.answer()
    uid=q.from_user.id
    db.create_user(uid,q.from_user.username or "")
    if q.data=="mine":
        u=db.credit(uid,10,"engagement_reward","proof_of_engagement")
        await q.edit_message_text(f"⛏️ تمت إضافة 10 3M\\n\\nرصيدك: {u['balance_3m']:.0f} 3M",reply_markup=keyboard())
    elif q.data=="daily":
        u,status=db.claim_daily(uid)
        if status=="already_claimed":
            await q.edit_message_text(f"🎁 استلمت مكافأة اليوم مسبقًا.\\n\\nرصيدك: {u['balance_3m']:.0f} 3M",reply_markup=keyboard())
        else:
            await q.edit_message_text(f"🎁 تمت إضافة 50 3M\\n\\nرصيدك: {u['balance_3m']:.0f} 3M",reply_markup=keyboard())
    elif q.data=="balance":
        u=db.get_user(uid)
        await q.edit_message_text(f"💰 رصيدك الحالي: {u['balance_3m']:.0f} 3M\\n\\nرمز العملة: 3M",reply_markup=keyboard())
    elif q.data == "referral":
        u = db.get_user(uid)
        await q.edit_message_text(f"🎁 رابط الإحالة الخاص بك 🎁\n{u['referral_link']}")

TOKEN = os.getenv("BOT_TOKEN")

def build_application():
    if not TOKEN: 
        raise RuntimeError("BOT_TOKEN is missing")
    
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(buttons))
    return app
    app = build_application()
    async def start_bot():
    app = build_application()
    await app.initialize()
    await app.start()
    await app.updater.start_polling(drop_pending_updates=True)
    print("Bot is running...")

if __name__ == "__main__":
    import asyncio
    asyncio.run(start_bot())

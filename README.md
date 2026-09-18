# 3Migo Coin (3M) — V1.1

3Migo Coin is a prototype of the 3MIGO SMART digital rewards ecosystem.

## Included
- Telegram bot with `/start`
- 3M internal balance
- Daily reward
- Proof-of-Engagement prototype reward
- Referral code
- SQLite persistence
- Revenue ledger
- Treasury allocation engine
- Admin revenue/stats endpoints
- FastAPI health endpoint
- Combined Render entry point (`main.py`)

## Revenue sources
- `telegram_ads`
- `direct_ads`
- `affiliate`
- `tasks`
- `partnership`

Revenue must be recorded only after it is actually confirmed. The prototype does not claim a fixed market value for 3M.

## Security
Never commit `BOT_TOKEN` or `ADMIN_KEY` to GitHub. Put them in Render Environment Variables.

## Local run
```bash
pip install -r requirements.txt
python main.py
```

## Render
Build Command:
`pip install -r requirements.txt`

Start Command:
`python main.py`

Health URL:
`/health`

## Status
Prototype only. No blockchain token exists in V1.1.

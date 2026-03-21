import aiohttp
from datetime import datetime
from loguru import logger
from app.core.config import settings

EMOJI = {"error": "🔴", "warning": "🟡", "info": "🟢", "recovery": "✅"}

def _fmt(level: str, message: str, source: str) -> str:
    ts = datetime.now().strftime("%d/%m %H:%M")
    return f"{EMOJI.get(level,'⚪')} *CITmax NOC*\n⏰ {ts}\n📟 {source}\n📋 {message}"

async def send_whatsapp(level: str, message: str, source: str):
    if not settings.WHATSAPP_API_URL: return
    try:
        async with aiohttp.ClientSession() as s:
            await s.post(
                f"{settings.WHATSAPP_API_URL}/message/sendText/citmax",
                json={"number": settings.WHATSAPP_NOTIFY_GROUP, "text": _fmt(level, message, source)},
                headers={"apikey": settings.WHATSAPP_API_KEY},
                timeout=aiohttp.ClientTimeout(total=8),
            )
    except Exception as e:
        logger.error(f"[WhatsApp] {e}")

async def send_telegram(level: str, message: str, source: str):
    if not settings.TELEGRAM_TOKEN: return
    try:
        async with aiohttp.ClientSession() as s:
            await s.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_TOKEN}/sendMessage",
                json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": _fmt(level, message, source), "parse_mode": "Markdown"},
                timeout=aiohttp.ClientTimeout(total=8),
            )
    except Exception as e:
        logger.error(f"[Telegram] {e}")

async def notify(level: str, message: str, source_name: str = "", **kw):
    logger.info(f"[ALERT] {level.upper()} | {source_name} | {message}")
    await send_whatsapp(level, message, source_name)
    await send_telegram(level, message, source_name)

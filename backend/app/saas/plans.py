"""
Planos padrão e enforcement de limites.
"""
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException
from app.models.saas import Plan, Tenant
from app.models.database import Device, User
from app.core.config import settings

# ─── Planos padrão ────────────────────────────────────────────────────────────
DEFAULT_PLANS = [
    {
        "name": "starter",
        "display_name": "Starter",
        "price_brl": 97.0,
        "max_devices": 10,
        "max_users": 3,
        "poll_interval_sec": 60,
        "features": ["dashboard", "devices", "links", "alerts", "whatsapp"],
    },
    {
        "name": "pro",
        "display_name": "Pro",
        "price_brl": 197.0,
        "max_devices": 50,
        "max_users": 10,
        "poll_interval_sec": 30,
        "features": ["dashboard", "devices", "links", "alerts", "whatsapp", "telegram", "ai_noc", "white_label"],
    },
    {
        "name": "enterprise",
        "display_name": "Enterprise",
        "price_brl": 397.0,
        "max_devices": -1,     # ilimitado
        "max_users": -1,
        "poll_interval_sec": 15,
        "features": ["dashboard", "devices", "links", "alerts", "whatsapp", "telegram", "ai_noc", "white_label", "api_access", "priority_support"],
    },
]


async def seed_plans(db: AsyncSession):
    """Cria os planos padrão se não existirem."""
    for p in DEFAULT_PLANS:
        r = await db.execute(select(Plan).where(Plan.name == p["name"]))
        if not r.scalar_one_or_none():
            db.add(Plan(**p))
    await db.commit()


async def get_plan(db: AsyncSession, plan_id: int) -> Plan:
    r = await db.execute(select(Plan).where(Plan.id == plan_id))
    return r.scalar_one_or_none()


async def check_device_limit(db: AsyncSession, tenant_id: int):
    """Lança exceção se o tenant atingiu o limite de devices do plano."""
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant não encontrado")

    plan = await get_plan(db, tenant.plan_id)
    if plan.max_devices == -1:
        return  # ilimitado

    count_r = await db.execute(
        select(func.count()).where(Device.tenant_id == tenant_id, Device.active == True)
    )
    count = count_r.scalar() or 0
    if count >= plan.max_devices:
        raise HTTPException(
            402,
            f"Limite de {plan.max_devices} dispositivos atingido no plano {plan.display_name}. "
            "Faça upgrade para adicionar mais."
        )


async def check_user_limit(db: AsyncSession, tenant_id: int):
    tenant = await db.get(Tenant, tenant_id)
    plan   = await get_plan(db, tenant.plan_id)
    if plan.max_users == -1:
        return
    count_r = await db.execute(
        select(func.count()).where(User.tenant_id == tenant_id, User.active == True)
    )
    count = count_r.scalar() or 0
    if count >= plan.max_users:
        raise HTTPException(
            402,
            f"Limite de {plan.max_users} usuários atingido. Faça upgrade para adicionar mais."
        )


async def is_tenant_active(db: AsyncSession, tenant_id: int) -> bool:
    """Retorna False se tenant estiver suspenso, cancelado ou com trial expirado."""
    tenant = await db.get(Tenant, tenant_id)
    if not tenant or not tenant.active:
        return False
    if tenant.status == "suspended":
        return False
    if tenant.status == "trial" and tenant.trial_ends_at:
        if datetime.utcnow() > tenant.trial_ends_at:
            return False
    return True


async def require_active_tenant(tenant_id: int, db: AsyncSession):
    if not await is_tenant_active(db, tenant_id):
        raise HTTPException(403, "Conta suspensa ou trial expirado. Verifique sua assinatura.")

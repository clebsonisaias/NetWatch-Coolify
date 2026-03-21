"""
Rotas SaaS:
  POST /api/public/register         — cadastro do provedor (público)
  GET  /api/public/plans            — lista planos (público)
  POST /api/public/checkout/{plan}  — inicia checkout Stripe
  POST /api/webhooks/stripe         — webhook Stripe
  POST /api/webhooks/mercadopago    — webhook MercPago

  GET  /api/tenant/me               — dados do tenant atual
  PUT  /api/tenant/me               — atualiza branding (logo, cor, nome)
  GET  /api/tenant/billing          — portal de faturamento
  GET  /api/tenant/usage            — uso atual (devices, users)

  GET  /api/superadmin/tenants      — todos os tenants (superadmin)
  PUT  /api/superadmin/tenants/{id} — edita tenant (superadmin)
  POST /api/superadmin/tenants/{id}/suspend
  POST /api/superadmin/tenants/{id}/activate
  GET  /api/superadmin/stats        — métricas gerais
"""

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta
import secrets, re

from app.models.database import get_db, Device, Link, User
from app.models.saas import Tenant, Plan, Payment
from app.core.auth import (hash_password, get_current_user, require_admin,
                            require_superadmin, get_tenant_id, create_token)
from app.core.config import settings
from app.saas.plans import seed_plans, check_device_limit, require_active_tenant
from app.saas.billing import stripe_service, mp_service

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    company_name: str
    email: str
    password: str
    phone: str = ""
    cnpj: str = ""
    city: str = ""
    state: str = ""
    plan: str = "starter"   # starter | pro | enterprise

class TenantBrandingIn(BaseModel):
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    app_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_api_url: Optional[str] = None
    whatsapp_api_key: Optional[str] = None
    whatsapp_group: Optional[str] = None
    telegram_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:32] + "-" + secrets.token_hex(3)


# ════════════════════════════════════════════════════════════════════════════
# PÚBLICO
# ════════════════════════════════════════════════════════════════════════════

@router.get("/public/plans")
async def list_plans(db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Plan).where(Plan.active == True).order_by(Plan.price_brl))
    return [_plan_dict(p) for p in r.scalars().all()]


@router.post("/public/register", status_code=201)
async def register_tenant(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    """
    Cadastro público de um novo provedor.
    Cria tenant em trial por 14 dias.
    """
    # Verifica e-mail único
    ex = await db.execute(select(Tenant).where(Tenant.email == body.email))
    if ex.scalar_one_or_none():
        raise HTTPException(400, "E-mail já cadastrado")

    # Busca plano
    plan_r = await db.execute(select(Plan).where(Plan.name == body.plan))
    plan = plan_r.scalar_one_or_none()
    if not plan:
        raise HTTPException(400, f"Plano '{body.plan}' não encontrado")

    # Cria tenant em trial
    tenant = Tenant(
        slug=_slugify(body.company_name),
        company_name=body.company_name,
        email=body.email,
        phone=body.phone,
        cnpj=body.cnpj,
        city=body.city,
        state=body.state,
        plan_id=plan.id,
        status="trial",
        trial_ends_at=datetime.utcnow() + timedelta(days=settings.TRIAL_DAYS),
        app_name="NetWatch",
        primary_color="#00c896",
    )
    db.add(tenant)
    await db.flush()  # gera tenant.id antes do commit

    # Cria usuário admin do tenant
    admin = User(
        tenant_id=tenant.id,
        name=body.company_name,
        email=body.email,
        hashed_pw=hash_password(body.password),
        role="admin",
        active=True,
    )
    db.add(admin)
    await db.commit()
    await db.refresh(tenant)
    await db.refresh(admin)

    # Gera token já autenticado
    token = create_token({
        "sub": str(admin.id),
        "tenant_id": tenant.id,
        "email": admin.email,
        "name": admin.name,
        "role": "admin",
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "tenant": _tenant_dict(tenant),
        "trial_ends_at": tenant.trial_ends_at.isoformat(),
        "message": f"Bem-vindo! Seu trial de {settings.TRIAL_DAYS} dias está ativo."
    }


# ─── Checkout Stripe ─────────────────────────────────────────────────────────
@router.post("/public/checkout/{plan_name}")
async def start_checkout(
    plan_name: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    tenant_id = get_tenant_id(user)
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant não encontrado")

    if not stripe_service.available:
        raise HTTPException(503, "Pagamento online não configurado. Entre em contato: contato@cit.net.br")

    checkout_url = await stripe_service.create_checkout_session(
        tenant=tenant,
        plan_name=plan_name,
        success_url=f"{settings.FRONTEND_URL}/billing/success",
        cancel_url=f"{settings.FRONTEND_URL}/billing",
    )
    return {"checkout_url": checkout_url}


# ─── Webhooks ─────────────────────────────────────────────────────────────────
@router.post("/webhooks/stripe", include_in_schema=False)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe_service.verify_webhook(payload, sig)
    except Exception as e:
        raise HTTPException(400, f"Webhook inválido: {e}")
    await stripe_service.handle_webhook(event, db)
    return {"ok": True}


@router.post("/webhooks/mercadopago", include_in_schema=False)
async def mp_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    data = await request.json()
    await mp_service.handle_webhook(data, db)
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════════════
# TENANT (autenticado)
# ════════════════════════════════════════════════════════════════════════════

@router.get("/tenant/me")
async def get_my_tenant(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    tenant = await db.get(Tenant, get_tenant_id(user))
    if not tenant:
        raise HTTPException(404, "Tenant não encontrado")
    plan_r = await db.execute(select(Plan).where(Plan.id == tenant.plan_id))
    plan   = plan_r.scalar_one_or_none()
    return {**_tenant_dict(tenant), "plan": _plan_dict(plan) if plan else None}


@router.put("/tenant/me")
async def update_my_tenant(
    body: TenantBrandingIn,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_admin),
):
    tenant = await db.get(Tenant, get_tenant_id(user))
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(tenant, k, v)
    tenant.updated_at = datetime.utcnow()
    await db.commit()
    return _tenant_dict(tenant)


@router.get("/tenant/usage")
async def get_usage(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    tid = get_tenant_id(user)
    dev_r  = await db.execute(select(func.count()).where(Device.tenant_id == tid, Device.active == True))
    usr_r  = await db.execute(select(func.count()).where(User.tenant_id == tid, User.active == True))
    lnk_r  = await db.execute(select(func.count()).where(Link.tenant_id == tid, Link.active == True))
    tenant = await db.get(Tenant, tid)
    plan_r = await db.execute(select(Plan).where(Plan.id == tenant.plan_id))
    plan   = plan_r.scalar_one_or_none()
    return {
        "devices":     {"current": dev_r.scalar(), "max": plan.max_devices if plan else 10},
        "users":       {"current": usr_r.scalar(), "max": plan.max_users   if plan else 3},
        "links":       {"current": lnk_r.scalar()},
        "plan":        plan.display_name if plan else "—",
        "status":      tenant.status,
        "trial_ends":  tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
    }


@router.get("/tenant/billing-portal")
async def billing_portal(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    tenant = await db.get(Tenant, get_tenant_id(user))
    if not stripe_service.available or not tenant.stripe_customer_id:
        raise HTTPException(503, "Portal de faturamento não disponível. Entre em contato.")
    url = await stripe_service.create_portal_session(
        tenant.stripe_customer_id,
        return_url=f"{settings.FRONTEND_URL}/billing"
    )
    return {"portal_url": url}


@router.get("/tenant/payments")
async def get_payments(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    tid = get_tenant_id(user)
    r = await db.execute(
        select(Payment).where(Payment.tenant_id == tid).order_by(Payment.created_at.desc()).limit(24)
    )
    return [_payment_dict(p) for p in r.scalars().all()]


# ════════════════════════════════════════════════════════════════════════════
# SUPER ADMIN (apenas você, CITmax)
# ════════════════════════════════════════════════════════════════════════════

@router.get("/superadmin/stats")
async def superadmin_stats(db: AsyncSession = Depends(get_db), _=Depends(require_superadmin)):
    total_r   = await db.execute(select(func.count()).select_from(Tenant).where(Tenant.active == True))
    active_r  = await db.execute(select(func.count()).select_from(Tenant).where(Tenant.status == "active"))
    trial_r   = await db.execute(select(func.count()).select_from(Tenant).where(Tenant.status == "trial"))
    dev_r     = await db.execute(select(func.count()).select_from(Device).where(Device.active == True))
    return {
        "total_tenants":  total_r.scalar(),
        "active_tenants": active_r.scalar(),
        "trial_tenants":  trial_r.scalar(),
        "total_devices":  dev_r.scalar(),
    }


@router.get("/superadmin/tenants")
async def list_all_tenants(db: AsyncSession = Depends(get_db), _=Depends(require_superadmin)):
    r = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = r.scalars().all()
    result = []
    for t in tenants:
        plan_r = await db.execute(select(Plan).where(Plan.id == t.plan_id))
        plan   = plan_r.scalar_one_or_none()
        dev_r  = await db.execute(select(func.count()).where(Device.tenant_id == t.id))
        result.append({**_tenant_dict(t), "plan": _plan_dict(plan) if plan else None, "device_count": dev_r.scalar()})
    return result


@router.put("/superadmin/tenants/{tenant_id}/suspend")
async def suspend_tenant(tenant_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_superadmin)):
    t = await db.get(Tenant, tenant_id)
    if not t: raise HTTPException(404, "Tenant não encontrado")
    t.status = "suspended"; await db.commit()
    return {"ok": True}


@router.put("/superadmin/tenants/{tenant_id}/activate")
async def activate_tenant(tenant_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_superadmin)):
    t = await db.get(Tenant, tenant_id)
    if not t: raise HTTPException(404, "Tenant não encontrado")
    t.status = "active"; await db.commit()
    return {"ok": True}


@router.put("/superadmin/tenants/{tenant_id}/plan/{plan_name}")
async def change_plan(tenant_id: int, plan_name: str, db: AsyncSession = Depends(get_db), _=Depends(require_superadmin)):
    t = await db.get(Tenant, tenant_id)
    if not t: raise HTTPException(404)
    p_r = await db.execute(select(Plan).where(Plan.name == plan_name))
    p = p_r.scalar_one_or_none()
    if not p: raise HTTPException(404, f"Plano '{plan_name}' não encontrado")
    t.plan_id = p.id; await db.commit()
    return {"ok": True}


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _plan_dict(p: Plan) -> dict:
    return {"id":p.id,"name":p.name,"display_name":p.display_name,"price_brl":p.price_brl,
            "max_devices":p.max_devices,"max_users":p.max_users,"features":p.features or []}

def _tenant_dict(t: Tenant) -> dict:
    return {
        "id":t.id, "slug":t.slug, "company_name":t.company_name, "email":t.email,
        "phone":t.phone, "city":t.city, "state":t.state,
        "logo_url":t.logo_url, "primary_color":t.primary_color, "app_name":t.app_name,
        "status":t.status, "plan_id":t.plan_id,
        "trial_ends_at": t.trial_ends_at.isoformat() if t.trial_ends_at else None,
        "created_at": t.created_at.isoformat(),
        "has_stripe": bool(t.stripe_customer_id),
        "whatsapp_configured": bool(t.whatsapp_api_url),
        "telegram_configured": bool(t.telegram_token),
    }

def _payment_dict(p: Payment) -> dict:
    return {"id":p.id,"amount_brl":p.amount_brl,"status":p.status,
            "payment_method":p.payment_method,"description":p.description,
            "paid_at":p.paid_at.isoformat() if p.paid_at else None,
            "created_at":p.created_at.isoformat()}

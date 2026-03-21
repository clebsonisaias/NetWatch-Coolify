"""
Modelos SaaS multi-tenant.
Toda tabela operacional (Device, Link, Alert, User) ganha um tenant_id.
"""
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, Text, ForeignKey, JSON
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.database import Base


# ─── Planos ───────────────────────────────────────────────────────────────────
class Plan(Base):
    __tablename__ = "plans"

    id                = Column(Integer, primary_key=True)
    name              = Column(String(64), unique=True, nullable=False)  # starter, pro, enterprise
    display_name      = Column(String(64), nullable=False)               # "Starter", "Pro"
    price_brl         = Column(Float, nullable=False)                    # preço mensal em R$
    max_devices       = Column(Integer, default=10)                      # -1 = ilimitado
    max_users         = Column(Integer, default=3)
    poll_interval_sec = Column(Integer, default=60)                      # intervalo de coleta
    features          = Column(JSON, default=list)                       # lista de features
    active            = Column(Boolean, default=True)
    created_at        = Column(DateTime, default=datetime.utcnow)


# ─── Tenant (cada provedor de internet) ───────────────────────────────────────
class Tenant(Base):
    __tablename__ = "tenants"

    id              = Column(Integer, primary_key=True)
    slug            = Column(String(64), unique=True, nullable=False)    # "citmax", "provedor-x"
    company_name    = Column(String(128), nullable=False)
    email           = Column(String(128), unique=True, nullable=False)   # email do admin
    phone           = Column(String(32), default="")
    cnpj            = Column(String(18), default="")
    city            = Column(String(64), default="")
    state           = Column(String(2), default="")

    # White-label
    logo_url        = Column(String(512), default="")
    primary_color   = Column(String(7), default="#00c896")               # hex
    app_name        = Column(String(64), default="NetWatch")

    # Plano atual
    plan_id         = Column(Integer, ForeignKey("plans.id"), nullable=False)
    plan_expires_at = Column(DateTime, nullable=True)

    # Status
    status          = Column(String(20), default="trial")                # trial | active | suspended | cancelled
    trial_ends_at   = Column(DateTime, nullable=True)

    # Pagamento
    stripe_customer_id      = Column(String(64), default="")
    stripe_subscription_id  = Column(String(64), default="")
    mercadopago_payer_id    = Column(String(64), default="")

    # Notificações
    whatsapp_api_url   = Column(String(256), default="")
    whatsapp_api_key   = Column(String(256), default="")
    whatsapp_group     = Column(String(128), default="")
    telegram_token     = Column(String(256), default="")
    telegram_chat_id   = Column(String(64),  default="")

    active          = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Pagamentos / histórico ───────────────────────────────────────────────────
class Payment(Base):
    __tablename__ = "payments"

    id              = Column(Integer, primary_key=True)
    tenant_id       = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    amount_brl      = Column(Float, nullable=False)
    status          = Column(String(20), default="pending")              # pending | paid | failed | refunded
    payment_method  = Column(String(20), default="stripe")
    external_id     = Column(String(128), default="")                    # ID no Stripe / MercPago
    description     = Column(String(256), default="")
    paid_at         = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

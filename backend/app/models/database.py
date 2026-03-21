from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from datetime import datetime
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase): pass

async def get_db():
    async with AsyncSessionLocal() as s:
        yield s

async def init_db():
    from app.models import metrics  # noqa
    from app.models import network  # noqa
    # importa todos os modelos para garantir que as tabelas sejam criadas
    from app.models import saas  # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# ─── Device ───────────────────────────────────────────────────────────────────
class Device(Base):
    __tablename__ = "devices"
    id         = Column(Integer, primary_key=True, index=True)
    tenant_id  = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name       = Column(String(64), nullable=False)
    vendor     = Column(String(20), nullable=False)
    model      = Column(String(64), default="")
    ip         = Column(String(45), nullable=False)
    location   = Column(String(64), default="")
    community  = Column(String(64), default="public")
    port       = Column(Integer, default=161)
    username   = Column(String(64), default="admin")
    password   = Column(String(128), default="")
    feature    = Column(String(64), default="")
    notes      = Column(Text, default="")
    status     = Column(String(20), default="unknown")
    cpu        = Column(Float, default=0)
    mem        = Column(Float, default=0)
    uptime_sec = Column(Integer, default=0)
    active     = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_seen  = Column(DateTime, nullable=True)


# ─── Link ─────────────────────────────────────────────────────────────────────
class Link(Base):
    __tablename__ = "links"
    id         = Column(Integer, primary_key=True, index=True)
    tenant_id  = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name       = Column(String(64), nullable=False)
    provider   = Column(String(64), nullable=False)
    bw_mbps    = Column(Integer, default=1000)
    ip_peer    = Column(String(45), default="")
    asn_peer   = Column(String(20), default="")
    asn_local  = Column(String(20), default="AS65001")
    in_bps     = Column(Float, default=0)
    out_bps    = Column(Float, default=0)
    loss_pct   = Column(Float, default=0)
    latency_ms = Column(Float, default=0)
    status     = Column(String(20), default="unknown")
    notes      = Column(Text, default="")
    active     = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Alert ────────────────────────────────────────────────────────────────────
class Alert(Base):
    __tablename__ = "alerts"
    id          = Column(Integer, primary_key=True, index=True)
    tenant_id   = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    level       = Column(String(10), nullable=False)
    source_type = Column(String(20), default="device")
    source_id   = Column(Integer, nullable=True)
    source_name = Column(String(64), default="")
    message     = Column(Text, nullable=False)
    resolved    = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


# ─── User ─────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id         = Column(Integer, primary_key=True, index=True)
    tenant_id  = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name       = Column(String(128), nullable=False)
    email      = Column(String(128), unique=True, nullable=False)
    hashed_pw  = Column(String(256), nullable=False)
    role       = Column(String(20), default="operator")   # admin | operator | viewer
    active     = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

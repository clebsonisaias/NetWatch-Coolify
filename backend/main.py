import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.core.config import settings
from app.models.database import init_db, AsyncSessionLocal, Device, User
from app.models import network  # noqa - ensure tables created
from app.models.saas import Tenant, Plan
from app.core.auth import hash_password, create_token, create_superadmin_token
from app.api.routes import router, broadcast
from app.api.saas_routes import router as saas_router
from app.api.network_routes import router as network_router
from app.saas.plans import seed_plans
from sqlalchemy import select


async def load_all_devices():
    """Retorna devices de TODOS os tenants para o coletor."""
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(Device).where(Device.active == True))
        return [{"id":d.id,"tenant_id":d.tenant_id,"name":d.name,"vendor":d.vendor,
                 "model":d.model,"ip":d.ip,"location":d.location,"community":d.community,
                 "port":d.port,"username":d.username,"password":d.password}
                for d in r.scalars().all()]

async def load_all_ips():
    devices = await load_all_devices()
    return [d["ip"] for d in devices]

async def seed_superadmin():
    """Cria tenant CITmax + super admin se não existir."""
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(Tenant).where(Tenant.slug == "citmax"))
        if r.scalar_one_or_none():
            return

        # Busca plano enterprise
        pr = await db.execute(select(Plan).where(Plan.name == "enterprise"))
        plan = pr.scalar_one_or_none()
        if not plan:
            return

        tenant = Tenant(
            slug="citmax", company_name="CITmax", email="clebson@cit.net.br",
            city="Natal", state="RN", plan_id=plan.id, status="active",
            app_name="CITmax Monitor", primary_color="#00c896",
        )
        db.add(tenant)
        await db.flush()

        admin = User(
            tenant_id=tenant.id, name="Clebson Isaias",
            email="clebson@cit.net.br", hashed_pw=hash_password("citmax2024"),
            role="admin", active=True,
        )
        db.add(admin)
        await db.commit()

        # Gera token super admin para logging (útil na primeira vez)
        token = create_superadmin_token({"sub": str(admin.id), "email": admin.email, "name": admin.name})
        logger.info(f"Super admin criado. Token: {token[:40]}...")
        logger.info("Login: clebson@cit.net.br / citmax2024")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Inicializando banco SaaS...")
    await init_db()

    async with AsyncSessionLocal() as db:
        await seed_plans(db)

    await seed_superadmin()

    # Coletor principal
    from app.collectors.manager import CollectorManager
    from app.collectors.ping import PingManager
    from app.core.notifications import notify

    col_mgr = CollectorManager(ws_broadcast=broadcast, on_alert=notify,
                                use_simulators=settings.DEBUG)
    ping_mgr = PingManager(ws_broadcast=broadcast, on_alert=notify)

    col_task  = asyncio.create_task(col_mgr.start_loop(load_all_devices, settings.POLL_INTERVAL_FAST))
    ping_task = asyncio.create_task(ping_mgr.start_loop(load_all_ips,    settings.POLL_INTERVAL_PING))

    logger.info(f"✓ NetWatch SaaS rodando | DEBUG={settings.DEBUG}")
    yield

    col_mgr.stop(); ping_mgr.stop()
    col_task.cancel(); ping_task.cancel()
    for t in [col_task, ping_task]:
        try: await t
        except asyncio.CancelledError: pass
    logger.info("Backend encerrado.")


app = FastAPI(
    title="NetWatch SaaS API",
    version="1.0.0",
    description="Plataforma de monitoramento de rede multi-tenant para provedores de internet",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router,        prefix="/api")
app.include_router(saas_router,   prefix="/api")
app.include_router(network_router, prefix="/api")

@app.get("/")
async def root():
    return {"app": "NetWatch SaaS", "version": "1.0.0", "status": "running", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "ok"}

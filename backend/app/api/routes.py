"""Rotas operacionais — todas com tenant_id isolado."""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import asyncio, json

from app.models.database import get_db, Device, Link, Alert, User
from app.models.saas import Tenant
from app.core.auth import (hash_password, verify_password, create_token,
                            get_current_user, require_admin, get_tenant_id)
from app.saas.plans import check_device_limit, check_user_limit, require_active_tenant

router = APIRouter()

# ─── WebSocket manager ────────────────────────────────────────────────────────
class WsManager:
    def __init__(self): self._conns: dict[int, list[WebSocket]] = {}  # tenant_id -> [ws]

    async def connect(self, ws: WebSocket, tenant_id: int):
        await ws.accept()
        self._conns.setdefault(tenant_id, []).append(ws)

    def disconnect(self, ws: WebSocket, tenant_id: int):
        if tenant_id in self._conns and ws in self._conns[tenant_id]:
            self._conns[tenant_id].remove(ws)

    async def broadcast_tenant(self, tenant_id: int, data: dict):
        """Envia apenas para o tenant correto."""
        msg = json.dumps(data, default=str)
        dead = []
        for ws in self._conns.get(tenant_id, []):
            try: await ws.send_text(msg)
            except: dead.append(ws)
        for ws in dead: self.disconnect(ws, tenant_id)

    async def broadcast_all(self, data: dict):
        for tid in list(self._conns.keys()):
            await self.broadcast_tenant(tid, data)

ws_mgr = WsManager()

async def broadcast(data: dict):
    """Chamado pelo CollectorManager — extrai tenant_id do payload."""
    tid = data.get("tenant_id")
    if tid:
        await ws_mgr.broadcast_tenant(int(tid), data)
    else:
        await ws_mgr.broadcast_all(data)

# ─── Auth ─────────────────────────────────────────────────────────────────────
@router.post("/auth/token")
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == form.username, User.active == True))
    u = r.scalar_one_or_none()
    if not u or not verify_password(form.password, u.hashed_pw):
        raise HTTPException(401, "Credenciais inválidas")

    # Verifica se tenant está ativo
    tenant = await db.get(Tenant, u.tenant_id)
    if not tenant or not tenant.active:
        raise HTTPException(403, "Conta suspensa. Entre em contato com o suporte.")

    token = create_token({
        "sub": str(u.id), "tenant_id": u.tenant_id,
        "email": u.email, "name": u.name, "role": u.role,
    })
    return {"access_token": token, "token_type": "bearer",
            "name": u.name, "role": u.role, "email": u.email,
            "tenant_id": u.tenant_id}

# ─── Devices ─────────────────────────────────────────────────────────────────
class DeviceIn(BaseModel):
    name: str; vendor: str; model: str = ""; ip: str
    location: str = ""; community: str = "public"; port: int = 161
    username: str = "admin"; password: str = ""
    feature: str = ""; notes: str = ""

@router.get("/devices")
async def list_devices(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    tid = get_tenant_id(user)
    r = await db.execute(select(Device).where(Device.tenant_id==tid, Device.active==True).order_by(Device.name))
    return [_ddict(d) for d in r.scalars().all()]

@router.post("/devices", status_code=201)
async def create_device(body: DeviceIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    tid = get_tenant_id(user)
    await require_active_tenant(tid, db)
    await check_device_limit(db, tid)
    d = Device(tenant_id=tid, **body.model_dump())
    db.add(d); await db.commit(); await db.refresh(d)
    return _ddict(d)

@router.put("/devices/{did}")
async def update_device(did: int, body: DeviceIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    d = await _g404_tenant(db, Device, did, get_tenant_id(user))
    for k,v in body.model_dump().items(): setattr(d, k, v)
    d.updated_at = datetime.utcnow(); await db.commit(); return _ddict(d)

@router.delete("/devices/{did}", status_code=204)
async def delete_device(did: int, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    d = await _g404_tenant(db, Device, did, get_tenant_id(user))
    d.active = False; await db.commit()

@router.post("/devices/{did}/collect")
async def collect_now(did: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    d = await _g404_tenant(db, Device, did, get_tenant_id(user))
    from app.collectors.manager import CollectorManager
    mgr = CollectorManager(use_simulators=True)
    r = await mgr.run_once([_ddict(d)])
    return r[0] if r else {}

# ─── Links ────────────────────────────────────────────────────────────────────
class LinkIn(BaseModel):
    name: str; provider: str; bw_mbps: int = 1000
    ip_peer: str = ""; asn_peer: str = ""; asn_local: str = "AS65001"; notes: str = ""

@router.get("/links")
async def list_links(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    tid = get_tenant_id(user)
    r = await db.execute(select(Link).where(Link.tenant_id==tid, Link.active==True))
    return [_ldict(l) for l in r.scalars().all()]

@router.post("/links", status_code=201)
async def create_link(body: LinkIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    tid = get_tenant_id(user)
    await require_active_tenant(tid, db)
    l = Link(tenant_id=tid, **body.model_dump())
    db.add(l); await db.commit(); await db.refresh(l); return _ldict(l)

@router.put("/links/{lid}")
async def update_link(lid: int, body: LinkIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    l = await _g404_tenant(db, Link, lid, get_tenant_id(user))
    for k,v in body.model_dump().items(): setattr(l, k, v)
    await db.commit(); return _ldict(l)

@router.delete("/links/{lid}", status_code=204)
async def delete_link(lid: int, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    l = await _g404_tenant(db, Link, lid, get_tenant_id(user))
    l.active = False; await db.commit()

# ─── Alerts ───────────────────────────────────────────────────────────────────
@router.get("/alerts")
async def list_alerts(resolved: bool = False, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    tid = get_tenant_id(user)
    r = await db.execute(select(Alert).where(Alert.tenant_id==tid, Alert.resolved==resolved).order_by(Alert.created_at.desc()).limit(100))
    return [_adict(a) for a in r.scalars().all()]

@router.patch("/alerts/{aid}/resolve")
async def resolve_alert(aid: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    a = await _g404_tenant(db, Alert, aid, get_tenant_id(user))
    a.resolved = True; a.resolved_at = datetime.utcnow(); await db.commit()
    return {"ok": True}

# ─── Users ────────────────────────────────────────────────────────────────────
class UserIn(BaseModel):
    name: str; email: str; password: str; role: str = "operator"; active: bool = True

class UserUpdate(BaseModel):
    name: str; email: str; role: str; active: bool; password: Optional[str] = None

@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    tid = get_tenant_id(user)
    r = await db.execute(select(User).where(User.tenant_id==tid).order_by(User.name))
    return [_udict(u) for u in r.scalars().all()]

@router.post("/users", status_code=201)
async def create_user(body: UserIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    tid = get_tenant_id(user)
    await check_user_limit(db, tid)
    ex = await db.execute(select(User).where(User.email == body.email))
    if ex.scalar_one_or_none(): raise HTTPException(400, "Email já cadastrado")
    u = User(tenant_id=tid, name=body.name, email=body.email, role=body.role,
             active=body.active, hashed_pw=hash_password(body.password))
    db.add(u); await db.commit(); await db.refresh(u); return _udict(u)

@router.put("/users/{uid}")
async def update_user(uid: int, body: UserUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    u = await _g404_tenant(db, User, uid, get_tenant_id(user))
    u.name=body.name; u.email=body.email; u.role=body.role; u.active=body.active
    if body.password: u.hashed_pw = hash_password(body.password)
    await db.commit(); return _udict(u)

@router.delete("/users/{uid}", status_code=204)
async def delete_user(uid: int, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    u = await _g404_tenant(db, User, uid, get_tenant_id(user))
    await db.delete(u); await db.commit()

# ─── Ping ─────────────────────────────────────────────────────────────────────
@router.get("/ping/{ip}")
async def do_ping(ip: str, _=Depends(get_current_user)):
    from app.collectors.ping import ping_host
    return await ping_host(ip, count=4)

# ─── WebSocket ────────────────────────────────────────────────────────────────
@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket, token: str = ""):
    """WS autenticado via query param: /ws?token=JWT"""
    from app.core.auth import get_current_user as _get
    try:
        from fastapi.security import OAuth2PasswordBearer
        from jose import jwt as _jwt
        payload = _jwt.decode(token, settings.SECRET_KEY if hasattr(settings,'SECRET_KEY') else "dev", algorithms=["HS256"])
        tenant_id = int(payload.get("tenant_id", 0))
    except Exception:
        await ws.close(code=4001)
        return

    from app.core.config import settings as cfg
    await ws_mgr.connect(ws, tenant_id)
    try:
        while True:
            try:
                msg = await asyncio.wait_for(ws.receive_text(), timeout=30)
                d = json.loads(msg)
                if d.get("type") == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"type": "heartbeat"}))
    except WebSocketDisconnect:
        ws_mgr.disconnect(ws, tenant_id)

# ─── Helpers ─────────────────────────────────────────────────────────────────
async def _g404_tenant(db, model, pk, tenant_id):
    r = await db.execute(select(model).where(model.id == pk, model.tenant_id == tenant_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, f"{model.__name__} não encontrado")
    return obj

def _ddict(d):
    return {"id":d.id,"name":d.name,"vendor":d.vendor,"model":d.model,"ip":d.ip,
            "location":d.location,"community":d.community,"port":d.port,"username":d.username,
            "feature":d.feature,"notes":d.notes,"status":d.status,"cpu":d.cpu,"mem":d.mem,
            "uptime":str(d.uptime_sec or 0),"last_seen":d.last_seen.isoformat() if d.last_seen else None}

def _ldict(l):
    bw = l.bw_mbps or 1000
    return {"id":l.id,"name":l.name,"provider":l.provider,
            "bw":str(bw//1000 if bw>=1000 else bw),"bwUnit":"G" if bw>=1000 else "M",
            "bw_mbps":bw,"ip":l.ip_peer,"asnPeer":l.asn_peer,
            "in":l.in_bps/1e9,"out":l.out_bps/1e9,"loss":l.loss_pct,"lat":l.latency_ms,
            "status":l.status,"notes":l.notes}

def _adict(a):
    return {"id":a.id,"level":a.level,"message":a.message,"source_name":a.source_name,
            "resolved":a.resolved,"created_at":a.created_at.isoformat()}

def _udict(u):
    return {"id":u.id,"name":u.name,"email":u.email,"role":u.role,"active":u.active}

# importa settings para o WS
from app.core.config import settings

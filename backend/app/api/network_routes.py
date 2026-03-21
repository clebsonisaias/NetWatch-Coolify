"""
Rotas da API para o mapa de rede.
POPs, rotas de fibra, alertas georreferenciados.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.models.database import get_db, Device
from app.models.network import Pop, FiberRoute, NetworkAlert
from app.core.auth import get_current_user, require_admin, get_tenant_id

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────
class PopIn(BaseModel):
    name: str
    type: str = "pop"
    lat: float
    lng: float
    address: str = ""
    city: str = ""
    status: str = "up"
    device_id: Optional[int] = None
    notes: str = ""
    power_type: str = "grid"
    capacity: int = 0
    used: int = 0

class FiberIn(BaseModel):
    name: str
    type: str = "backbone"
    color: str = "#00c896"
    coordinates: List[List[float]]  # [[lat,lng],...]
    length_m: float = 0
    fiber_count: int = 12
    status: str = "up"
    pop_start_id: Optional[int] = None
    pop_end_id: Optional[int] = None
    notes: str = ""

class AlertIn(BaseModel):
    level: str
    message: str
    pop_id: Optional[int] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_m: float = 500


# ─── POPs ─────────────────────────────────────────────────────────────────────
@router.get("/map/pops")
async def list_pops(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    tid = get_tenant_id(user)
    r = await db.execute(select(Pop).where(Pop.tenant_id==tid, Pop.active==True))
    pops = r.scalars().all()
    result = []
    for p in pops:
        d = _pop_dict(p)
        # Enriquece com dados do device vinculado
        if p.device_id:
            dr = await db.execute(select(Device).where(Device.id==p.device_id))
            dev = dr.scalar_one_or_none()
            if dev:
                d['device'] = {'name':dev.name,'vendor':dev.vendor,'status':dev.status,'cpu':dev.cpu,'mem':dev.mem}
        result.append(d)
    return result

@router.post("/map/pops", status_code=201)
async def create_pop(body: PopIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    tid = get_tenant_id(user)
    p = Pop(tenant_id=tid, **body.model_dump())
    db.add(p); await db.commit(); await db.refresh(p)
    return _pop_dict(p)

@router.put("/map/pops/{pid}")
async def update_pop(pid: int, body: PopIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    p = await _g404(db, Pop, pid, get_tenant_id(user))
    for k,v in body.model_dump().items(): setattr(p, k, v)
    p.updated_at = datetime.utcnow()
    await db.commit(); return _pop_dict(p)

@router.delete("/map/pops/{pid}", status_code=204)
async def delete_pop(pid: int, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    p = await _g404(db, Pop, pid, get_tenant_id(user))
    p.active = False; await db.commit()

@router.patch("/map/pops/{pid}/status")
async def update_pop_status(pid: int, status: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    p = await _g404(db, Pop, pid, get_tenant_id(user))
    p.status = status; await db.commit()
    return {"ok": True}


# ─── Fiber Routes ─────────────────────────────────────────────────────────────
@router.get("/map/fibers")
async def list_fibers(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    tid = get_tenant_id(user)
    r = await db.execute(select(FiberRoute).where(FiberRoute.tenant_id==tid, FiberRoute.active==True))
    return [_fiber_dict(f) for f in r.scalars().all()]

@router.post("/map/fibers", status_code=201)
async def create_fiber(body: FiberIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    tid = get_tenant_id(user)
    f = FiberRoute(tenant_id=tid, **body.model_dump())
    db.add(f); await db.commit(); await db.refresh(f)
    return _fiber_dict(f)

@router.put("/map/fibers/{fid}")
async def update_fiber(fid: int, body: FiberIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    f = await _g404(db, FiberRoute, fid, get_tenant_id(user))
    for k,v in body.model_dump().items(): setattr(f, k, v)
    f.updated_at = datetime.utcnow()
    await db.commit(); return _fiber_dict(f)

@router.delete("/map/fibers/{fid}", status_code=204)
async def delete_fiber(fid: int, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    f = await _g404(db, FiberRoute, fid, get_tenant_id(user))
    f.active = False; await db.commit()


# ─── Network Alerts ───────────────────────────────────────────────────────────
@router.get("/map/alerts")
async def list_map_alerts(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    tid = get_tenant_id(user)
    r = await db.execute(select(NetworkAlert).where(NetworkAlert.tenant_id==tid, NetworkAlert.resolved==False))
    return [_nalert_dict(a) for a in r.scalars().all()]

@router.post("/map/alerts", status_code=201)
async def create_map_alert(body: AlertIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    tid = get_tenant_id(user)
    a = NetworkAlert(tenant_id=tid, **body.model_dump())
    db.add(a); await db.commit(); await db.refresh(a)
    return _nalert_dict(a)

@router.patch("/map/alerts/{aid}/resolve")
async def resolve_map_alert(aid: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    a = await _g404(db, NetworkAlert, aid, get_tenant_id(user))
    a.resolved = True; a.resolved_at = datetime.utcnow()
    await db.commit(); return {"ok": True}


# ─── Map summary ──────────────────────────────────────────────────────────────
@router.get("/map/summary")
async def map_summary(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    tid = get_tenant_id(user)
    pops_r    = await db.execute(select(Pop).where(Pop.tenant_id==tid, Pop.active==True))
    fibers_r  = await db.execute(select(FiberRoute).where(FiberRoute.tenant_id==tid, FiberRoute.active==True))
    alerts_r  = await db.execute(select(NetworkAlert).where(NetworkAlert.tenant_id==tid, NetworkAlert.resolved==False))
    pops   = pops_r.scalars().all()
    fibers = fibers_r.scalars().all()
    alerts = alerts_r.scalars().all()
    return {
        "pops":        len(pops),
        "pops_up":     sum(1 for p in pops if p.status=='up'),
        "pops_down":   sum(1 for p in pops if p.status=='down'),
        "pops_warning":sum(1 for p in pops if p.status=='warning'),
        "fibers":      len(fibers),
        "fiber_km":    round(sum(f.length_m for f in fibers)/1000, 2),
        "alerts":      len(alerts),
        "alerts_error":sum(1 for a in alerts if a.level=='error'),
    }


# ─── Helpers ─────────────────────────────────────────────────────────────────
async def _g404(db, model, pk, tenant_id):
    r = await db.execute(select(model).where(model.id==pk, model.tenant_id==tenant_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, f"{model.__name__} não encontrado")
    return obj

def _pop_dict(p):
    return {
        "id":p.id,"name":p.name,"type":p.type,"lat":p.lat,"lng":p.lng,
        "address":p.address,"city":p.city,"status":p.status,
        "device_id":p.device_id,"notes":p.notes,"power_type":p.power_type,
        "capacity":p.capacity,"used":p.used,
        "created_at":p.created_at.isoformat(),
    }

def _fiber_dict(f):
    return {
        "id":f.id,"name":f.name,"type":f.type,"color":f.color,
        "coordinates":f.coordinates,"length_m":f.length_m,
        "fiber_count":f.fiber_count,"status":f.status,
        "pop_start_id":f.pop_start_id,"pop_end_id":f.pop_end_id,"notes":f.notes,
    }

def _nalert_dict(a):
    return {
        "id":a.id,"level":a.level,"message":a.message,
        "pop_id":a.pop_id,"lat":a.lat,"lng":a.lng,"radius_m":a.radius_m,
        "created_at":a.created_at.isoformat(),
    }

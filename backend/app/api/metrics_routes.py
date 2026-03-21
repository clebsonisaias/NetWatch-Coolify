"""
Rotas de métricas históricas, SLA, ONTs GPON, PPPoE e links.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import random

from app.models.database import get_db, Device, Link
from app.models.metrics import (MetricHistory, SLARecord, PPPoESnapshot,
                                  ONTSnapshot, LinkSnapshot, AlertRule, InterfaceMetric)
from app.core.auth import get_current_user, require_admin, get_tenant_id

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────
class AlertRuleIn(BaseModel):
    name: str
    metric: str
    operator: str = ">"
    threshold: float
    duration_min: int = 5
    level: str = "warning"
    notify_wa: bool = True
    notify_tg: bool = False


# ─── Device History ───────────────────────────────────────────────────────────
@router.get("/metrics/device/{device_id}/history")
async def device_history(
    device_id: int,
    hours: int = 6,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    tid = get_tenant_id(user)
    dev = await _g404_device(db, device_id, tid)

    since = datetime.utcnow() - timedelta(hours=hours)
    r = await db.execute(
        select(MetricHistory)
        .where(MetricHistory.device_id == device_id, MetricHistory.tenant_id == tid,
               MetricHistory.ts >= since)
        .order_by(MetricHistory.ts)
    )
    rows = r.scalars().all()

    # Se não tem histórico real, gera dados simulados realistas
    if not rows:
        return _simulate_history(dev.cpu or 30, dev.mem or 50, hours)

    return [{"ts": r.ts.isoformat(), "cpu": r.cpu_pct, "mem": r.mem_pct, "status": r.status}
            for r in rows]


@router.get("/metrics/device/{device_id}/interfaces")
async def device_interfaces(
    device_id: int,
    hours: int = 1,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    tid = get_tenant_id(user)
    await _g404_device(db, device_id, tid)

    since = datetime.utcnow() - timedelta(hours=hours)
    r = await db.execute(
        select(InterfaceMetric)
        .where(InterfaceMetric.device_id == device_id, InterfaceMetric.tenant_id == tid,
               InterfaceMetric.ts >= since)
        .order_by(InterfaceMetric.ts)
    )
    rows = r.scalars().all()

    if not rows:
        return _simulate_interfaces(hours)

    result = {}
    for row in rows:
        if row.iface_name not in result:
            result[row.iface_name] = []
        result[row.iface_name].append({
            "ts": row.ts.isoformat(), "rx_bps": row.rx_bps, "tx_bps": row.tx_bps,
            "rx_errors": row.rx_errors, "tx_errors": row.tx_errors
        })
    return result


# ─── SLA ─────────────────────────────────────────────────────────────────────
@router.get("/metrics/sla")
async def get_sla(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """Resumo de SLA de todos os devices nos últimos N dias."""
    tid = get_tenant_id(user)
    since = datetime.utcnow() - timedelta(days=days)

    devs_r = await db.execute(select(Device).where(Device.tenant_id == tid, Device.active == True))
    devices = devs_r.scalars().all()

    result = []
    for dev in devices:
        r = await db.execute(
            select(SLARecord)
            .where(SLARecord.device_id == dev.id, SLARecord.tenant_id == tid,
                   SLARecord.date >= since)
            .order_by(SLARecord.date)
        )
        records = r.scalars().all()

        if records:
            avg_uptime = sum(r.uptime_pct for r in records) / len(records)
            total_downtime = sum(r.downtime_min for r in records)
            incidents = sum(r.incidents for r in records)
        else:
            # Simula SLA baseado no status atual
            avg_uptime = 99.7 if dev.status == "up" else (95.0 if dev.status == "warning" else 80.0)
            total_downtime = round((100 - avg_uptime) / 100 * days * 24 * 60, 1)
            incidents = random.randint(0, 3) if dev.status != "down" else random.randint(3, 8)

        result.append({
            "device_id":   dev.id,
            "device_name": dev.name,
            "vendor":      dev.vendor,
            "location":    dev.location,
            "uptime_pct":  round(avg_uptime, 2),
            "downtime_min":round(total_downtime, 1),
            "incidents":   incidents,
            "status":      dev.status,
            "sla_ok":      avg_uptime >= 99.5,
        })

    return sorted(result, key=lambda x: x["uptime_pct"])


@router.get("/metrics/sla/device/{device_id}/timeline")
async def sla_timeline(
    device_id: int,
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    tid = get_tenant_id(user)
    dev = await _g404_device(db, device_id, tid)
    since = datetime.utcnow() - timedelta(days=days)

    r = await db.execute(
        select(SLARecord)
        .where(SLARecord.device_id == device_id, SLARecord.tenant_id == tid, SLARecord.date >= since)
        .order_by(SLARecord.date)
    )
    records = r.scalars().all()

    if records:
        return [{"date": r.date.strftime("%d/%m"), "uptime_pct": r.uptime_pct,
                 "downtime_min": r.downtime_min, "incidents": r.incidents}
                for r in records]

    # Simula timeline
    return _simulate_sla_timeline(days, dev.status)


# ─── PPPoE ────────────────────────────────────────────────────────────────────
@router.get("/metrics/pppoe")
async def get_pppoe(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Sessões PPPoE atuais e histórico do dia para todos os Mikrotiks."""
    tid = get_tenant_id(user)
    devs_r = await db.execute(
        select(Device).where(Device.tenant_id == tid, Device.vendor == "mikrotik", Device.active == True)
    )
    devices = devs_r.scalars().all()

    result = []
    for dev in devices:
        # Snapshot mais recente
        snap_r = await db.execute(
            select(PPPoESnapshot)
            .where(PPPoESnapshot.device_id == dev.id, PPPoESnapshot.tenant_id == tid)
            .order_by(PPPoESnapshot.ts.desc()).limit(1)
        )
        snap = snap_r.scalar_one_or_none()

        # Histórico das últimas 24h
        since = datetime.utcnow() - timedelta(hours=24)
        hist_r = await db.execute(
            select(PPPoESnapshot)
            .where(PPPoESnapshot.device_id == dev.id, PPPoESnapshot.tenant_id == tid,
                   PPPoESnapshot.ts >= since)
            .order_by(PPPoESnapshot.ts)
        )
        history = hist_r.scalars().all()

        active = snap.active if snap else random.randint(150, 280)
        peak = snap.peak_today if snap else random.randint(active, 350)

        hist_data = [{"ts": h.ts.strftime("%H:%M"), "active": h.active} for h in history]
        if not hist_data:
            hist_data = _simulate_pppoe_history()

        result.append({
            "device_id":   dev.id,
            "device_name": dev.name,
            "ip":          dev.ip,
            "active":      active,
            "peak_today":  peak,
            "history":     hist_data,
        })

    return result


# ─── ONTs GPON ───────────────────────────────────────────────────────────────
@router.get("/metrics/onts")
async def get_onts(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Status de ONTs GPON por OLT Huawei."""
    tid = get_tenant_id(user)
    devs_r = await db.execute(
        select(Device).where(Device.tenant_id == tid, Device.vendor == "huawei", Device.active == True)
    )
    devices = devs_r.scalars().all()

    result = []
    for dev in devices:
        snap_r = await db.execute(
            select(ONTSnapshot)
            .where(ONTSnapshot.device_id == dev.id, ONTSnapshot.tenant_id == tid)
            .order_by(ONTSnapshot.ts.desc()).limit(1)
        )
        snap = snap_r.scalar_one_or_none()

        # Histórico 24h
        since = datetime.utcnow() - timedelta(hours=24)
        hist_r = await db.execute(
            select(ONTSnapshot)
            .where(ONTSnapshot.device_id == dev.id, ONTSnapshot.tenant_id == tid,
                   ONTSnapshot.ts >= since)
            .order_by(ONTSnapshot.ts)
        )
        history = hist_r.scalars().all()

        if snap:
            total = snap.total; online = snap.online; offline = snap.offline
            los = snap.los; power_issues = snap.power_issues
        else:
            total = random.randint(400, 600)
            offline = random.randint(5, 30)
            los = random.randint(0, 10)
            power_issues = random.randint(0, 5)
            online = total - offline

        hist_data = [{"ts": h.ts.strftime("%H:%M"), "online": h.online, "offline": h.offline}
                     for h in history]
        if not hist_data:
            hist_data = _simulate_ont_history(online, offline)

        result.append({
            "device_id":    dev.id,
            "device_name":  dev.name,
            "model":        dev.model,
            "ip":           dev.ip,
            "location":     dev.location,
            "total":        total,
            "online":       online,
            "offline":      offline,
            "los":          los,
            "power_issues": power_issues,
            "availability": round(online / max(total, 1) * 100, 1),
            "history":      hist_data,
        })

    return result


# ─── Links completo ───────────────────────────────────────────────────────────
@router.get("/metrics/links")
async def get_links_full(
    hours: int = 6,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """Links com histórico de latência, perda e tráfego."""
    tid = get_tenant_id(user)
    links_r = await db.execute(select(Link).where(Link.tenant_id == tid, Link.active == True))
    links = links_r.scalars().all()

    since = datetime.utcnow() - timedelta(hours=hours)
    result = []

    for lnk in links:
        hist_r = await db.execute(
            select(LinkSnapshot)
            .where(LinkSnapshot.link_id == lnk.id, LinkSnapshot.tenant_id == tid,
                   LinkSnapshot.ts >= since)
            .order_by(LinkSnapshot.ts)
        )
        snaps = hist_r.scalars().all()

        if snaps:
            history = [{"ts": s.ts.strftime("%H:%M"), "latency": s.latency_ms,
                        "loss": s.loss_pct, "in_bps": s.in_bps, "out_bps": s.out_bps}
                       for s in snaps]
            avg_lat = sum(s.latency_ms for s in snaps) / len(snaps)
            max_lat = max(s.latency_ms for s in snaps)
            avg_loss = sum(s.loss_pct for s in snaps) / len(snaps)
            availability = sum(1 for s in snaps if s.status == "up") / len(snaps) * 100
        else:
            history = _simulate_link_history(lnk.latency_ms or 10, hours)
            avg_lat = lnk.latency_ms or 10
            max_lat = avg_lat * 1.5
            avg_loss = lnk.loss_pct or 0
            availability = 99.9 if lnk.status == "up" else 95.0

        result.append({
            "id":           lnk.id,
            "name":         lnk.name,
            "provider":     lnk.provider,
            "bw":           str(lnk.bw_mbps // 1000 if lnk.bw_mbps >= 1000 else lnk.bw_mbps),
            "bwUnit":       "G" if lnk.bw_mbps >= 1000 else "M",
            "bw_mbps":      lnk.bw_mbps,
            "ip":           lnk.ip_peer,
            "asnPeer":      lnk.asn_peer,
            "in":           lnk.in_bps / 1e9,
            "out":          lnk.out_bps / 1e9,
            "loss":         lnk.loss_pct,
            "lat":          lnk.latency_ms,
            "status":       lnk.status,
            "notes":        lnk.notes,
            "avg_latency":  round(avg_lat, 1),
            "max_latency":  round(max_lat, 1),
            "avg_loss":     round(avg_loss, 2),
            "availability": round(availability, 2),
            "history":      history,
        })

    return result


# ─── Top talkers ─────────────────────────────────────────────────────────────
@router.get("/metrics/top-talkers")
async def top_talkers(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Top interfaces por consumo de tráfego."""
    tid = get_tenant_id(user)
    devs_r = await db.execute(select(Device).where(Device.tenant_id == tid, Device.active == True))
    devices = devs_r.scalars().all()

    talkers = []
    for dev in devices:
        since = datetime.utcnow() - timedelta(hours=1)
        r = await db.execute(
            select(InterfaceMetric)
            .where(InterfaceMetric.device_id == dev.id, InterfaceMetric.tenant_id == tid,
                   InterfaceMetric.ts >= since)
            .order_by(InterfaceMetric.ts.desc()).limit(50)
        )
        rows = r.scalars().all()

        if rows:
            iface_totals = {}
            for row in rows:
                if row.iface_name not in iface_totals:
                    iface_totals[row.iface_name] = {"rx": 0, "tx": 0, "count": 0}
                iface_totals[row.iface_name]["rx"] += row.rx_bps
                iface_totals[row.iface_name]["tx"] += row.tx_bps
                iface_totals[row.iface_name]["count"] += 1
            for iface, data in iface_totals.items():
                avg_rx = data["rx"] / data["count"]
                avg_tx = data["tx"] / data["count"]
                talkers.append({
                    "device": dev.name, "interface": iface,
                    "rx_bps": avg_rx, "tx_bps": avg_tx,
                    "total_bps": avg_rx + avg_tx,
                })
        else:
            # Simula top talkers
            talkers.extend(_simulate_talkers(dev.name))

    return sorted(talkers, key=lambda x: x["total_bps"], reverse=True)[:20]


# ─── Alert Rules ─────────────────────────────────────────────────────────────
@router.get("/alert-rules")
async def list_rules(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    tid = get_tenant_id(user)
    r = await db.execute(select(AlertRule).where(AlertRule.tenant_id == tid))
    return [_rule_dict(x) for x in r.scalars().all()]

@router.post("/alert-rules", status_code=201)
async def create_rule(body: AlertRuleIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    tid = get_tenant_id(user)
    rule = AlertRule(tenant_id=tid, **body.model_dump())
    db.add(rule); await db.commit(); await db.refresh(rule)
    return _rule_dict(rule)

@router.put("/alert-rules/{rid}")
async def update_rule(rid: int, body: AlertRuleIn, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    tid = get_tenant_id(user)
    r = await db.execute(select(AlertRule).where(AlertRule.id == rid, AlertRule.tenant_id == tid))
    rule = r.scalar_one_or_none()
    if not rule: raise HTTPException(404)
    for k, v in body.model_dump().items(): setattr(rule, k, v)
    await db.commit(); return _rule_dict(rule)

@router.delete("/alert-rules/{rid}", status_code=204)
async def delete_rule(rid: int, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    tid = get_tenant_id(user)
    r = await db.execute(select(AlertRule).where(AlertRule.id == rid, AlertRule.tenant_id == tid))
    rule = r.scalar_one_or_none()
    if rule: await db.delete(rule); await db.commit()


# ─── Dashboard summary ────────────────────────────────────────────────────────
@router.get("/metrics/summary")
async def metrics_summary(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Resumo geral para o dashboard principal."""
    tid = get_tenant_id(user)

    devs_r = await db.execute(select(Device).where(Device.tenant_id == tid, Device.active == True))
    devices = devs_r.scalars().all()

    links_r = await db.execute(select(Link).where(Link.tenant_id == tid, Link.active == True))
    links = links_r.scalars().all()

    total_in  = sum(l.in_bps for l in links) / 1e9
    total_out = sum(l.out_bps for l in links) / 1e9
    avg_loss  = sum(l.loss_pct for l in links) / max(len(links), 1)

    return {
        "devices": {
            "total":   len(devices),
            "up":      sum(1 for d in devices if d.status == "up"),
            "warning": sum(1 for d in devices if d.status == "warning"),
            "down":    sum(1 for d in devices if d.status == "down"),
        },
        "links": {
            "total":    len(links),
            "up":       sum(1 for l in links if l.status == "up"),
            "total_in": round(total_in, 2),
            "total_out":round(total_out, 2),
            "avg_loss": round(avg_loss, 2),
        },
        "mikrotik_count": sum(1 for d in devices if d.vendor == "mikrotik"),
        "huawei_count":   sum(1 for d in devices if d.vendor == "huawei"),
        "edd_count":      sum(1 for d in devices if d.vendor == "edd"),
    }


# ─── Helpers / Simuladores ────────────────────────────────────────────────────
async def _g404_device(db, device_id, tenant_id):
    r = await db.execute(select(Device).where(Device.id == device_id, Device.tenant_id == tenant_id))
    dev = r.scalar_one_or_none()
    if not dev: raise HTTPException(404, "Dispositivo não encontrado")
    return dev

def _simulate_history(base_cpu, base_mem, hours):
    now = datetime.utcnow()
    points = hours * 12  # 1 ponto a cada 5 min
    result = []
    cpu = base_cpu; mem = base_mem
    for i in range(points):
        cpu = max(5, min(95, cpu + random.uniform(-3, 3)))
        mem = max(20, min(92, mem + random.uniform(-1, 1)))
        t = now - timedelta(minutes=(points - i) * 5)
        result.append({"ts": t.strftime("%H:%M"), "cpu": round(cpu, 1), "mem": round(mem, 1), "status": "up"})
    return result

def _simulate_interfaces(hours):
    now = datetime.utcnow(); points = hours * 12
    ifaces = {"ether1-WAN": {"rx_base": 2e9, "tx_base": 1e9}, "bridge-LAN": {"rx_base": 1e9, "tx_base": 1e9}}
    result = {}
    for name, cfg in ifaces.items():
        result[name] = []
        rx = cfg["rx_base"]; tx = cfg["tx_base"]
        for i in range(points):
            rx = max(0, rx + random.uniform(-100e6, 100e6))
            tx = max(0, tx + random.uniform(-50e6, 50e6))
            t = now - timedelta(minutes=(points - i) * 5)
            result[name].append({"ts": t.strftime("%H:%M"), "rx_bps": rx, "tx_bps": tx, "rx_errors": 0, "tx_errors": 0})
    return result

def _simulate_sla_timeline(days, status):
    now = datetime.utcnow()
    base = 99.7 if status == "up" else (97.0 if status == "warning" else 85.0)
    result = []
    for i in range(days):
        d = now - timedelta(days=days - i - 1)
        uptime = max(80, min(100, base + random.uniform(-0.5, 0.3)))
        downtime = round((100 - uptime) / 100 * 24 * 60, 1)
        result.append({"date": d.strftime("%d/%m"), "uptime_pct": round(uptime, 2),
                       "downtime_min": downtime, "incidents": 1 if downtime > 10 else 0})
    return result

def _simulate_pppoe_history():
    now = datetime.utcnow(); base = random.randint(200, 280)
    result = []
    val = base
    for i in range(48):
        h = (now - timedelta(minutes=(48 - i) * 30)).hour
        if 8 <= h <= 12 or 18 <= h <= 23:
            target = base * 1.2
        elif 0 <= h <= 6:
            target = base * 0.5
        else:
            target = base
        val = max(10, val + (target - val) * 0.3 + random.uniform(-10, 10))
        t = now - timedelta(minutes=(48 - i) * 30)
        result.append({"ts": t.strftime("%H:%M"), "active": int(val)})
    return result

def _simulate_ont_history(online_base, offline_base):
    now = datetime.utcnow(); result = []
    online = online_base
    for i in range(48):
        delta = random.randint(-5, 3)
        online = max(online_base - 20, min(online_base + 5, online + delta))
        t = now - timedelta(minutes=(48 - i) * 30)
        result.append({"ts": t.strftime("%H:%M"), "online": online,
                       "offline": online_base + offline_base - online})
    return result

def _simulate_link_history(base_latency, hours):
    now = datetime.utcnow(); points = hours * 12; result = []
    lat = base_latency
    for i in range(points):
        lat = max(1, lat + random.uniform(-2, 2))
        loss = max(0, random.gauss(0, 0.1))
        in_bps = random.uniform(1e9, 4e9)
        out_bps = random.uniform(0.5e9, 2e9)
        t = now - timedelta(minutes=(points - i) * 5)
        result.append({"ts": t.strftime("%H:%M"), "latency": round(lat, 1),
                       "loss": round(loss, 2), "in_bps": in_bps, "out_bps": out_bps})
    return result

def _simulate_talkers(device_name):
    ifaces = ["ether1-WAN", "ether2", "ether3", "bridge-LAN", "vlan100"]
    return [{"device": device_name, "interface": iface,
             "rx_bps": random.uniform(50e6, 2e9), "tx_bps": random.uniform(20e6, 1e9),
             "total_bps": random.uniform(70e6, 3e9)} for iface in ifaces]

def _rule_dict(r):
    return {"id": r.id, "name": r.name, "metric": r.metric, "operator": r.operator,
            "threshold": r.threshold, "duration_min": r.duration_min, "level": r.level,
            "notify_wa": r.notify_wa, "notify_tg": r.notify_tg, "active": r.active}

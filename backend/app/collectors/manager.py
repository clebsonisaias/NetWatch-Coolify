"""Orquestra todos os coletores."""
import asyncio
from datetime import datetime
from loguru import logger
from app.core.config import settings
from app.collectors.mikrotik import MikrotikCollector, MikrotikSimulator
from app.collectors.snmp import SNMPCollector, SNMPSimulator


class CollectorManager:
    def __init__(self, ws_broadcast=None, on_alert=None, use_simulators=False):
        self.ws_broadcast   = ws_broadcast
        self.on_alert       = on_alert
        self.use_simulators = use_simulators
        self._running       = False

    def _build(self, device: dict):
        vendor = device.get("vendor","mikrotik")
        if self.use_simulators:
            if vendor == "mikrotik": return MikrotikSimulator(name=device["name"])
            return SNMPSimulator(name=device["name"], vendor=vendor)
        ip   = device["ip"]
        port = int(device.get("port", 8728))
        if vendor == "mikrotik":
            return MikrotikCollector(ip=ip, username=device.get("username","admin"),
                                     password=device.get("password",""), port=port)
        # edd ou huawei → SNMP como fallback principal
        # (NETCONF Huawei pode ser adicionado aqui futuramente)
        return SNMPCollector(ip=ip, community=device.get("community","public"), port=port)

    async def _collect_one(self, device: dict) -> dict:
        col  = self._build(device)
        data = await col.collect()
        sys  = data.get("system", {})

        # Atualizar status no banco
        await self._update_device_status(device["id"], data.get("status","unknown"),
                                          sys.get("cpu_pct",0), sys.get("mem_pct",0),
                                          sys.get("uptime_sec",0))

        # Avaliar alertas
        if data.get("status") == "down" and self.on_alert:
            await self.on_alert(level="error",
                                message=f"{device['name']} — Host inacessível",
                                source_name=device["name"])
        if sys.get("cpu_pct",0) > settings.ALERT_CPU_THRESHOLD and self.on_alert:
            await self.on_alert(level="warning",
                                message=f"{device['name']} — CPU {sys['cpu_pct']:.0f}%",
                                source_name=device["name"])
        if sys.get("mem_pct",0) > settings.ALERT_MEM_THRESHOLD and self.on_alert:
            await self.on_alert(level="warning",
                                message=f"{device['name']} — Memória {sys['mem_pct']:.0f}%",
                                source_name=device["name"])

        return {
            "device_id":   device["id"],
            "device_name": device["name"],
            "vendor":      device["vendor"],
            "ip":          device["ip"],
            "status":      data.get("status","unknown"),
            "cpu_pct":     sys.get("cpu_pct", 0),
            "mem_pct":     sys.get("mem_pct", 0),
            "uptime_sec":  sys.get("uptime_sec", 0),
            "interfaces":  data.get("interfaces", []),
            "bgp":         data.get("bgp", []),
            "pppoe":       data.get("pppoe", {}),
            "collected_at":data.get("collected_at"),
        }

    async def _update_device_status(self, device_id, status, cpu, mem, uptime):
        """Persiste métricas atuais no banco."""
        try:
            from app.models.database import AsyncSessionLocal, Device
            from sqlalchemy import select
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Device).where(Device.id == device_id))
                dev = result.scalar_one_or_none()
                if dev:
                    dev.status     = status
                    dev.cpu        = cpu
                    dev.mem        = mem
                    dev.uptime_sec = uptime
                    dev.last_seen  = datetime.utcnow()
                    await db.commit()
        except Exception as e:
            logger.error(f"DB update error: {e}")

    async def run_once(self, devices: list) -> list:
        tasks   = [self._collect_one(d) for d in devices]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        output  = []
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                logger.error(f"Coleta falhou {devices[i]['name']}: {r}")
                output.append({"device_id": devices[i]["id"], "status": "down", "error": str(r)})
            else:
                output.append(r)
        if self.ws_broadcast:
            await self.ws_broadcast({"type": "metrics_update", "data": output})
        return output

    async def start_loop(self, devices_fn, interval: int = None):
        interval = interval or settings.POLL_INTERVAL_FAST
        self._running = True
        logger.info(f"CollectorManager iniciado — intervalo {interval}s")
        while self._running:
            try:
                devices = await devices_fn()
                if devices:
                    await self.run_once(devices)
            except Exception as e:
                logger.error(f"Loop error: {e}")
            await asyncio.sleep(interval)

    def stop(self):
        self._running = False

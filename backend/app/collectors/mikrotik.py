"""Coletor Mikrotik via RouterOS API (porta 8728)."""
import asyncio
from datetime import datetime
from loguru import logger

try:
    from librouteros import connect
    HAS_LIB = True
except ImportError:
    HAS_LIB = False


class MikrotikCollector:
    def __init__(self, ip, username="admin", password="", port=8728, timeout=10):
        self.ip = ip; self.username = username
        self.password = password; self.port = port; self.timeout = timeout

    async def collect(self) -> dict:
        loop = asyncio.get_event_loop()
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(None, self._sync), timeout=self.timeout + 5)
        except Exception as e:
            logger.error(f"[Mikrotik] {self.ip}: {e}")
            return {"status": "down", "error": str(e), "collected_at": datetime.utcnow().isoformat()}

    def _sync(self) -> dict:
        if not HAS_LIB:
            raise RuntimeError("librouteros não instalado")
        api = connect(host=self.ip, username=self.username,
                      password=self.password, port=self.port, timeout=self.timeout)
        try:
            # System resource
            res  = list(api(cmd="/system/resource/print"))[0]
            iden = list(api(cmd="/system/identity/print"))[0]
            cpu  = float(res.get("cpu-load", 0))
            mt   = int(res.get("total-memory", 1))
            mf   = int(res.get("free-memory", 0))

            # Interfaces
            ifaces_raw = list(api(cmd="/interface/print", stats=True))
            ifaces = [{
                "name":    i.get("name",""),
                "running": i.get("running","false") == "true",
                "rx_bps":  float(i.get("rx-bits-per-second", 0)),
                "tx_bps":  float(i.get("tx-bits-per-second", 0)),
                "rx_errors": int(i.get("rx-error", 0)),
                "tx_errors": int(i.get("tx-error", 0)),
                "comment": i.get("comment",""),
            } for i in ifaces_raw]

            # BGP
            bgp = []
            try:
                for p in list(api(cmd="/routing/bgp/peer/print", stats=True)):
                    bgp.append({
                        "name": p.get("name",""), "remote_as": p.get("remote-as",""),
                        "remote_address": p.get("remote-address",""),
                        "state": p.get("state",""), "prefix_count": int(p.get("prefix-count",0)),
                        "uptime": p.get("uptime",""),
                    })
            except Exception:
                pass  # RouterOS v7 path diferente

            # PPPoE sessions
            pppoe_count = 0
            try:
                pppoe_count = len(list(api(cmd="/interface/pppoe-server/active/print")))
            except Exception:
                pass

            return {
                "status": "up",
                "collected_at": datetime.utcnow().isoformat(),
                "system": {
                    "name": iden.get("name", self.ip),
                    "model": res.get("board-name",""),
                    "version": res.get("version",""),
                    "cpu_pct": cpu,
                    "mem_pct": round((1 - mf/max(mt,1)) * 100, 1),
                    "uptime_sec": self._uptime(res.get("uptime","")),
                },
                "interfaces": ifaces,
                "bgp": bgp,
                "pppoe": {"active_sessions": pppoe_count},
            }
        finally:
            api.close()

    @staticmethod
    def _uptime(s: str) -> int:
        import re
        total = 0
        for v, u in re.findall(r"(\d+)([wdhms])", s):
            total += int(v) * {"w":604800,"d":86400,"h":3600,"m":60,"s":1}[u]
        return total


class MikrotikSimulator:
    """Simulador para desenvolvimento sem equipamento real."""
    def __init__(self, name="SIM-RB"):
        self.name = name
        self._cpu = 30.0; self._mem = 55.0; self._up = 0

    async def collect(self) -> dict:
        import random
        self._cpu = max(5, min(95, self._cpu + random.uniform(-5, 5)))
        self._mem = max(20, min(90, self._mem + random.uniform(-2, 2)))
        self._up += 30
        return {
            "status": "up",
            "collected_at": datetime.utcnow().isoformat(),
            "system": {
                "name": self.name, "model": "CCR2004-16G-2S+ (sim)",
                "version": "7.14.3", "cpu_pct": round(self._cpu,1),
                "mem_pct": round(self._mem,1), "uptime_sec": self._up,
            },
            "interfaces": [
                {"name":"ether1-WAN","running":True,
                 "rx_bps":random.uniform(2e9,4e9),"tx_bps":random.uniform(1e9,2e9),
                 "rx_errors":0,"tx_errors":0,"comment":"uplink"},
            ],
            "bgp": [
                {"name":"vivo","remote_as":"7738","remote_address":"189.1.2.1",
                 "state":"Established","prefix_count":842341,"uptime":"142d"},
            ],
            "pppoe": {"active_sessions": random.randint(180, 260)},
        }

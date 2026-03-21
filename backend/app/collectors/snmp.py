"""Coletor SNMP v2c — EDD Datacom e genérico."""
import asyncio
from datetime import datetime
from loguru import logger

try:
    from pysnmp.hlapi.asyncio import (
        getCmd, nextCmd, SnmpEngine, CommunityData,
        UdpTransportTarget, ContextData, ObjectType, ObjectIdentity,
    )
    HAS_SNMP = True
except ImportError:
    HAS_SNMP = False

OID = {
    "sysName":    "1.3.6.1.2.1.1.5.0",
    "sysDescr":   "1.3.6.1.2.1.1.1.0",
    "sysUpTime":  "1.3.6.1.2.1.1.3.0",
    "hrCpuLoad":  "1.3.6.1.2.1.25.3.3.1.2.768",
    "hrMemTotal": "1.3.6.1.2.1.25.2.3.1.5.1",
    "hrMemUsed":  "1.3.6.1.2.1.25.2.3.1.6.1",
    "ifDescr":    "1.3.6.1.2.1.2.2.1.2",
    "ifOperStatus":"1.3.6.1.2.1.2.2.1.8",
    "ifHCInOctets":"1.3.6.1.2.1.31.1.1.1.6",
    "ifHCOutOctets":"1.3.6.1.2.1.31.1.1.1.10",
}

class SNMPCollector:
    def __init__(self, ip, community="public", port=161, timeout=10):
        self.ip = ip; self.community = community
        self.port = port; self.timeout = timeout
        self._engine = SnmpEngine() if HAS_SNMP else None

    async def collect(self) -> dict:
        if not HAS_SNMP:
            return {"status":"down","error":"pysnmp não instalado","collected_at":datetime.utcnow().isoformat()}
        try:
            sys_data = await self._get(OID["sysName"], OID["sysDescr"], OID["sysUpTime"],
                                       OID["hrCpuLoad"], OID["hrMemTotal"], OID["hrMemUsed"])
            up_ticks = int(sys_data.get(OID["sysUpTime"],0) or 0)
            cpu      = float(sys_data.get(OID["hrCpuLoad"],0) or 0)
            mt       = int(sys_data.get(OID["hrMemTotal"],1) or 1)
            mu       = int(sys_data.get(OID["hrMemUsed"],0) or 0)
            ifaces   = await self._get_ifaces()
            return {
                "status": "up",
                "collected_at": datetime.utcnow().isoformat(),
                "system": {
                    "name": sys_data.get(OID["sysName"], self.ip),
                    "description": sys_data.get(OID["sysDescr"],""),
                    "cpu_pct": cpu, "mem_pct": round(mu/max(mt,1)*100,1),
                    "uptime_sec": up_ticks // 100,
                },
                "interfaces": ifaces,
            }
        except Exception as e:
            logger.error(f"[SNMP] {self.ip}: {e}")
            return {"status":"down","error":str(e),"collected_at":datetime.utcnow().isoformat()}

    async def _get(self, *oids) -> dict:
        objs = [ObjectType(ObjectIdentity(o)) for o in oids]
        errInd, errSt, _, vbs = await getCmd(
            self._engine, CommunityData(self.community, mpModel=1),
            UdpTransportTarget((self.ip, self.port), timeout=self.timeout, retries=1),
            ContextData(), *objs)
        if errInd or errSt: return {}
        return {str(vb[0]): str(vb[1]) for vb in vbs}

    async def _get_ifaces(self) -> list:
        descrs  = {o.rsplit(".",1)[-1]: v for o,v in await self._walk(OID["ifDescr"])}
        statuses= {o.rsplit(".",1)[-1]: v for o,v in await self._walk(OID["ifOperStatus"])}
        in_oct  = {o.rsplit(".",1)[-1]: int(v) for o,v in await self._walk(OID["ifHCInOctets"])}
        out_oct = {o.rsplit(".",1)[-1]: int(v) for o,v in await self._walk(OID["ifHCOutOctets"])}
        return [{
            "name": name, "running": statuses.get(i,"2")=="1",
            "in_octets": in_oct.get(i,0), "out_octets": out_oct.get(i,0),
        } for i, name in descrs.items()]

    async def _walk(self, oid: str) -> list:
        results = []
        async for (errInd, errSt, _, vbs) in nextCmd(
            self._engine, CommunityData(self.community, mpModel=1),
            UdpTransportTarget((self.ip, self.port), timeout=self.timeout, retries=1),
            ContextData(), ObjectType(ObjectIdentity(oid)), lexicographicMode=False):
            if errInd or errSt: break
            results.extend((str(vb[0]), str(vb[1])) for vb in vbs)
        return results


class SNMPSimulator:
    def __init__(self, name="SIM-SW", vendor="edd"):
        self.name=name; self.vendor=vendor; self._cpu=15.0; self._mem=40.0

    async def collect(self) -> dict:
        import random
        self._cpu = max(5, min(90, self._cpu+random.uniform(-4,4)))
        self._mem = max(20, min(85, self._mem+random.uniform(-2,2)))
        return {
            "status":"up", "collected_at":datetime.utcnow().isoformat(),
            "system":{"name":self.name,"description":f"{self.vendor} switch (sim)",
                      "cpu_pct":round(self._cpu,1),"mem_pct":round(self._mem,1),
                      "uptime_sec":random.randint(86400,8640000)},
            "interfaces":[{"name":f"GE0/{i}","running":random.random()>.1,
                           "in_octets":random.randint(0,10**11),"out_octets":random.randint(0,10**11)}
                          for i in range(1,9)],
        }

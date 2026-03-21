"""
Coletor de latência via ICMP ping (asyncio subprocess).
Roda em loop separado, mais frequente que o coletor principal.
Coleta: latência média, mínima, máxima e % de perda.
"""
import asyncio
import re
from datetime import datetime
from loguru import logger


async def ping_host(ip: str, count: int = 5, timeout: int = 5) -> dict:
    """
    Executa ping ICMP para um host e retorna métricas.
    Funciona em Linux (dentro do container Docker).
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            "ping", "-c", str(count), "-W", str(timeout), ip,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout + 3)
        output = stdout.decode()
        return _parse_ping(ip, output, proc.returncode)
    except asyncio.TimeoutError:
        return {"ip": ip, "status": "down", "loss_pct": 100.0,
                "latency_avg": 0, "latency_min": 0, "latency_max": 0,
                "collected_at": datetime.utcnow().isoformat()}
    except Exception as e:
        logger.error(f"[Ping] {ip}: {e}")
        return {"ip": ip, "status": "down", "loss_pct": 100.0,
                "latency_avg": 0, "latency_min": 0, "latency_max": 0,
                "collected_at": datetime.utcnow().isoformat()}


def _parse_ping(ip: str, output: str, returncode: int) -> dict:
    """Parseia output do ping Linux."""
    result = {
        "ip": ip,
        "status": "up" if returncode == 0 else "down",
        "loss_pct": 100.0,
        "latency_avg": 0.0,
        "latency_min": 0.0,
        "latency_max": 0.0,
        "collected_at": datetime.utcnow().isoformat(),
    }

    # Perda de pacotes: "2 packets transmitted, 2 received, 0% packet loss"
    loss_match = re.search(r"(\d+(?:\.\d+)?)%\s+packet loss", output)
    if loss_match:
        result["loss_pct"] = float(loss_match.group(1))

    # RTT: "rtt min/avg/max/mdev = 8.123/9.456/11.789/0.500 ms"
    rtt_match = re.search(r"rtt\s+\S+\s+=\s+([\d.]+)/([\d.]+)/([\d.]+)", output)
    if rtt_match:
        result["latency_min"] = float(rtt_match.group(1))
        result["latency_avg"] = float(rtt_match.group(2))
        result["latency_max"] = float(rtt_match.group(3))
        # Classificar status por latência
        if result["loss_pct"] == 0:
            result["status"] = "up"
        elif result["loss_pct"] < 5:
            result["status"] = "warning"
        else:
            result["status"] = "down"

    return result


class PingManager:
    """
    Gerencia pings periódicos de todos os dispositivos e links.
    Roda em loop paralelo ao coletor principal.
    """

    def __init__(self, ws_broadcast=None, on_alert=None):
        self.ws_broadcast = ws_broadcast
        self.on_alert     = on_alert
        self._running     = False
        self._results     = {}  # ip -> último resultado

    def get_result(self, ip: str) -> dict:
        return self._results.get(ip, {})

    async def ping_many(self, ips: list) -> dict:
        """Pinga múltiplos IPs em paralelo."""
        tasks = [ping_host(ip) for ip in ips]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        output = {}
        for ip, r in zip(ips, results):
            if isinstance(r, Exception):
                output[ip] = {"ip": ip, "status": "down", "loss_pct": 100.0,
                              "latency_avg": 0, "latency_min": 0, "latency_max": 0}
            else:
                output[ip] = r
                self._results[ip] = r
        return output

    async def start_loop(self, get_ips_fn, interval: int = 10):
        """Loop contínuo de ping."""
        self._running = True
        logger.info(f"PingManager iniciado. Intervalo: {interval}s")

        # Thresholds para alerta
        from app.core.config import settings
        lat_thresh  = settings.ALERT_LATENCY_MS
        loss_thresh = settings.ALERT_LOSS_THRESHOLD

        while self._running:
            try:
                ips = await get_ips_fn()
                if ips:
                    results = await self.ping_many(ips)

                    # Avalia alertas
                    for ip, r in results.items():
                        if r["loss_pct"] > loss_thresh and self.on_alert:
                            await self.on_alert(
                                level="warning",
                                message=f"Perda {r['loss_pct']:.1f}% para {ip}",
                                source_name=ip,
                            )
                        if r["latency_avg"] > lat_thresh and r["latency_avg"] > 0 and self.on_alert:
                            await self.on_alert(
                                level="warning",
                                message=f"Latência {r['latency_avg']:.0f}ms para {ip}",
                                source_name=ip,
                            )

                    # Broadcast WebSocket
                    if self.ws_broadcast:
                        await self.ws_broadcast({
                            "type": "ping_update",
                            "data": results,
                        })
            except Exception as e:
                logger.error(f"PingManager loop error: {e}")

            await asyncio.sleep(interval)

    def stop(self):
        self._running = False

"""
Modelos de séries temporais e SLA.
Armazena histórico de métricas sem depender do InfluxDB.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from datetime import datetime
from app.models.database import Base


class MetricHistory(Base):
    """Histórico de métricas de dispositivos — CPU, mem, tráfego."""
    __tablename__ = "metric_history"
    id         = Column(Integer, primary_key=True, index=True)
    tenant_id  = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    device_id  = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    ts         = Column(DateTime, default=datetime.utcnow, index=True)
    cpu_pct    = Column(Float, default=0)
    mem_pct    = Column(Float, default=0)
    uptime_sec = Column(Integer, default=0)
    status     = Column(String(20), default="up")


class InterfaceMetric(Base):
    """Histórico de tráfego por interface."""
    __tablename__ = "interface_metrics"
    id         = Column(Integer, primary_key=True, index=True)
    tenant_id  = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    device_id  = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    ts         = Column(DateTime, default=datetime.utcnow, index=True)
    iface_name = Column(String(64), default="")
    rx_bps     = Column(Float, default=0)
    tx_bps     = Column(Float, default=0)
    rx_errors  = Column(Integer, default=0)
    tx_errors  = Column(Integer, default=0)


class SLARecord(Base):
    """Registro diário de SLA por dispositivo."""
    __tablename__ = "sla_records"
    id           = Column(Integer, primary_key=True, index=True)
    tenant_id    = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    device_id    = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    date         = Column(DateTime, index=True)
    uptime_pct   = Column(Float, default=100.0)
    downtime_min = Column(Float, default=0)
    incidents    = Column(Integer, default=0)


class PPPoESnapshot(Base):
    """Snapshot de sessões PPPoE ativas."""
    __tablename__ = "pppoe_snapshots"
    id         = Column(Integer, primary_key=True, index=True)
    tenant_id  = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    device_id  = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    ts         = Column(DateTime, default=datetime.utcnow, index=True)
    active     = Column(Integer, default=0)
    peak_today = Column(Integer, default=0)


class ONTSnapshot(Base):
    """Snapshot de ONTs GPON por OLT."""
    __tablename__ = "ont_snapshots"
    id            = Column(Integer, primary_key=True, index=True)
    tenant_id     = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    device_id     = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    ts            = Column(DateTime, default=datetime.utcnow, index=True)
    total         = Column(Integer, default=0)
    online        = Column(Integer, default=0)
    offline       = Column(Integer, default=0)
    los           = Column(Integer, default=0)   # Loss of Signal
    power_issues  = Column(Integer, default=0)


class LinkSnapshot(Base):
    """Snapshot de métricas de link (ping + velocidade)."""
    __tablename__ = "link_snapshots"
    id         = Column(Integer, primary_key=True, index=True)
    tenant_id  = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    link_id    = Column(Integer, ForeignKey("links.id"), nullable=False, index=True)
    ts         = Column(DateTime, default=datetime.utcnow, index=True)
    latency_ms = Column(Float, default=0)
    loss_pct   = Column(Float, default=0)
    in_bps     = Column(Float, default=0)
    out_bps    = Column(Float, default=0)
    status     = Column(String(20), default="up")


class AlertRule(Base):
    """Regras de alertas configuráveis por tenant."""
    __tablename__ = "alert_rules"
    id           = Column(Integer, primary_key=True, index=True)
    tenant_id    = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name         = Column(String(64), nullable=False)
    metric       = Column(String(32), nullable=False)  # cpu | mem | loss | latency | ont_offline
    operator     = Column(String(4), default=">")       # > | < | >= | <=
    threshold    = Column(Float, nullable=False)
    duration_min = Column(Integer, default=5)           # minutos acima do threshold para disparar
    level        = Column(String(10), default="warning")# error | warning
    notify_wa    = Column(Boolean, default=True)
    notify_tg    = Column(Boolean, default=False)
    active       = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)

"""
Modelos de infraestrutura de rede para o mapa.
POPs, rotas de fibra, clientes no mapa.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from datetime import datetime
from app.models.database import Base


class Pop(Base):
    """Ponto de Presença — abrigo, poste, datacenter."""
    __tablename__ = "pops"

    id          = Column(Integer, primary_key=True, index=True)
    tenant_id   = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name        = Column(String(64), nullable=False)
    type        = Column(String(20), default="pop")   # pop | datacenter | cto | ceo | splitter | client
    lat         = Column(Float, nullable=False)
    lng         = Column(Float, nullable=False)
    address     = Column(String(256), default="")
    city        = Column(String(64), default="")
    status      = Column(String(20), default="up")    # up | warning | down | unknown
    device_id   = Column(Integer, ForeignKey("devices.id"), nullable=True)  # device vinculado
    notes       = Column(Text, default="")
    power_type  = Column(String(20), default="grid")  # grid | nobreak | solar
    capacity    = Column(Integer, default=0)           # portas/splitters disponíveis
    used        = Column(Integer, default=0)           # portas/splitters em uso
    active      = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FiberRoute(Base):
    """Rota de fibra entre dois pontos."""
    __tablename__ = "fiber_routes"

    id          = Column(Integer, primary_key=True, index=True)
    tenant_id   = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name        = Column(String(64), nullable=False)
    type        = Column(String(20), default="backbone")  # backbone | distribution | access | drop
    color       = Column(String(7), default="#00c896")
    coordinates = Column(JSON, nullable=False)    # [[lat,lng], [lat,lng], ...]
    length_m    = Column(Float, default=0)        # comprimento em metros
    fiber_count = Column(Integer, default=12)     # quantidade de fibras
    status      = Column(String(20), default="up")
    pop_start_id= Column(Integer, ForeignKey("pops.id"), nullable=True)
    pop_end_id  = Column(Integer, ForeignKey("pops.id"), nullable=True)
    notes       = Column(Text, default="")
    active      = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NetworkAlert(Base):
    """Alerta georreferenciado — associado a um POP ou região."""
    __tablename__ = "network_alerts"

    id          = Column(Integer, primary_key=True, index=True)
    tenant_id   = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    level       = Column(String(10), nullable=False)   # error | warning | info
    message     = Column(Text, nullable=False)
    pop_id      = Column(Integer, ForeignKey("pops.id"), nullable=True)
    lat         = Column(Float, nullable=True)
    lng         = Column(Float, nullable=True)
    radius_m    = Column(Float, default=500)           # raio do alerta em metros
    resolved    = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

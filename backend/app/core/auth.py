from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")
ALGORITHM = "HS256"

def hash_password(p: str) -> str: return pwd_ctx.hash(p)
def verify_password(plain: str, hashed: str) -> bool: return pwd_ctx.verify(plain, hashed)

def create_token(data: dict) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(hours=8)}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)

def create_superadmin_token(data: dict) -> str:
    payload = {**data, "superadmin": True, "exp": datetime.utcnow() + timedelta(hours=4)}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user

async def require_superadmin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("superadmin"):
        raise HTTPException(status_code=403, detail="Acesso restrito ao super admin")
    return user

def get_tenant_id(user: dict) -> int:
    tid = user.get("tenant_id")
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant não identificado")
    return int(tid)

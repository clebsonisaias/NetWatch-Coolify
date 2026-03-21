from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "NetWatch SaaS"
    SECRET_KEY: str = "dev-secret-troque-em-producao"
    DEBUG: bool = False

    DATABASE_URL: str = "sqlite+aiosqlite:///./netwatch.db"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    POLL_INTERVAL_FAST: int = 30
    POLL_INTERVAL_PING: int = 10

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_STARTER: str = ""   # price_xxx do Stripe
    STRIPE_PRICE_PRO: str = ""
    STRIPE_PRICE_ENTERPRISE: str = ""

    # Mercado Pago (alternativa)
    MP_ACCESS_TOKEN: str = ""
    MP_WEBHOOK_SECRET: str = ""

    # App URL (para webhooks e e-mails)
    APP_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"

    # Trial
    TRIAL_DAYS: int = 14

    @property
    def cors_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"

settings = Settings()

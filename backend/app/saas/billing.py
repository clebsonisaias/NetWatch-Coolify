"""
Integração de cobrança.
Suporta Stripe (recomendado) e Mercado Pago (opção BR).
"""
import hmac, hashlib, json
from datetime import datetime
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.saas import Tenant, Plan, Payment


# ─── Stripe ───────────────────────────────────────────────────────────────────
class StripeService:

    def __init__(self):
        self._stripe = None
        if settings.STRIPE_SECRET_KEY:
            try:
                import stripe
                stripe.api_key = settings.STRIPE_SECRET_KEY
                self._stripe = stripe
                logger.info("Stripe inicializado.")
            except ImportError:
                logger.warning("stripe não instalado. pip install stripe")

    @property
    def available(self) -> bool:
        return self._stripe is not None

    async def create_checkout_session(
        self,
        tenant: Tenant,
        plan_name: str,
        success_url: str,
        cancel_url: str,
    ) -> str:
        """Cria sessão de checkout Stripe e retorna a URL."""
        if not self.available:
            raise RuntimeError("Stripe não configurado")

        price_map = {
            "starter":    settings.STRIPE_PRICE_STARTER,
            "pro":        settings.STRIPE_PRICE_PRO,
            "enterprise": settings.STRIPE_PRICE_ENTERPRISE,
        }
        price_id = price_map.get(plan_name)
        if not price_id:
            raise ValueError(f"Plano '{plan_name}' sem price_id configurado")

        # Cria ou reutiliza customer
        customer_id = tenant.stripe_customer_id
        if not customer_id:
            customer = self._stripe.Customer.create(
                email=tenant.email,
                name=tenant.company_name,
                metadata={"tenant_id": str(tenant.id), "slug": tenant.slug},
            )
            customer_id = customer.id

        session = self._stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=cancel_url,
            metadata={"tenant_id": str(tenant.id), "plan": plan_name},
            subscription_data={
                "trial_period_days": 0,
                "metadata": {"tenant_id": str(tenant.id)},
            },
        )
        return session.url

    async def create_portal_session(self, customer_id: str, return_url: str) -> str:
        """URL do portal de gerenciamento de assinatura do Stripe."""
        if not self.available:
            raise RuntimeError("Stripe não configurado")
        session = self._stripe.billing_portal.Session.create(
            customer=customer_id, return_url=return_url,
        )
        return session.url

    def verify_webhook(self, payload: bytes, sig: str) -> dict:
        """Verifica assinatura do webhook Stripe e retorna o evento."""
        if not self.available:
            raise RuntimeError("Stripe não configurado")
        return self._stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )

    async def handle_webhook(self, event: dict, db: AsyncSession):
        """Processa eventos do webhook Stripe."""
        etype = event.get("type")
        data  = event.get("data", {}).get("object", {})

        if etype == "checkout.session.completed":
            tenant_id  = int(data.get("metadata", {}).get("tenant_id", 0))
            plan_name  = data.get("metadata", {}).get("plan", "starter")
            sub_id     = data.get("subscription", "")
            customer_id= data.get("customer", "")
            await self._activate_tenant(db, tenant_id, plan_name, sub_id, customer_id)

        elif etype in ("invoice.payment_succeeded",):
            sub_id   = data.get("subscription", "")
            amount   = data.get("amount_paid", 0) / 100
            await self._record_payment(db, sub_id, amount, "paid")

        elif etype in ("invoice.payment_failed", "customer.subscription.deleted"):
            sub_id = data.get("id") or data.get("subscription", "")
            await self._suspend_by_subscription(db, sub_id)

        logger.info(f"[Stripe] Evento processado: {etype}")

    async def _activate_tenant(self, db, tenant_id, plan_name, sub_id, customer_id):
        r = await db.execute(select(Plan).where(Plan.name == plan_name))
        plan = r.scalar_one_or_none()
        if not plan:
            return
        tenant = await db.get(Tenant, tenant_id)
        if tenant:
            tenant.plan_id                = plan.id
            tenant.stripe_customer_id     = customer_id
            tenant.stripe_subscription_id = sub_id
            tenant.status                 = "active"
            tenant.trial_ends_at          = None
            await db.commit()
            logger.info(f"[Stripe] Tenant {tenant_id} ativado no plano {plan_name}")

    async def _record_payment(self, db, sub_id, amount, status):
        r = await db.execute(select(Tenant).where(Tenant.stripe_subscription_id == sub_id))
        tenant = r.scalar_one_or_none()
        if tenant:
            db.add(Payment(
                tenant_id=tenant.id, amount_brl=amount,
                status=status, payment_method="stripe",
                external_id=sub_id, paid_at=datetime.utcnow(),
                description="Assinatura mensal NetWatch"
            ))
            await db.commit()

    async def _suspend_by_subscription(self, db, sub_id):
        r = await db.execute(select(Tenant).where(Tenant.stripe_subscription_id == sub_id))
        tenant = r.scalar_one_or_none()
        if tenant:
            tenant.status = "suspended"
            await db.commit()
            logger.warning(f"[Stripe] Tenant {tenant.id} suspenso (pagamento falhou)")


# ─── Mercado Pago (alternativa brasileira) ───────────────────────────────────
class MercadoPagoService:

    def __init__(self):
        self._mp = None
        if settings.MP_ACCESS_TOKEN:
            try:
                import mercadopago
                self._sdk = mercadopago.SDK(settings.MP_ACCESS_TOKEN)
                self._mp = True
                logger.info("Mercado Pago inicializado.")
            except ImportError:
                logger.warning("mercadopago não instalado. pip install mercadopago")

    @property
    def available(self) -> bool:
        return self._mp is not None

    async def create_preference(self, tenant: Tenant, plan: Plan, back_urls: dict) -> str:
        """Cria preferência de pagamento e retorna init_point (URL de checkout)."""
        if not self.available:
            raise RuntimeError("Mercado Pago não configurado")

        preference_data = {
            "items": [{
                "title": f"NetWatch {plan.display_name}",
                "quantity": 1,
                "unit_price": plan.price_brl,
                "currency_id": "BRL",
            }],
            "payer": {"email": tenant.email, "name": tenant.company_name},
            "back_urls": back_urls,
            "auto_return": "approved",
            "external_reference": str(tenant.id),
            "notification_url": f"{settings.APP_URL}/api/webhooks/mercadopago",
        }
        result = self._sdk.preference().create(preference_data)
        return result["response"]["init_point"]

    def verify_webhook(self, payload: str, secret: str, sig: str) -> bool:
        expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, sig)

    async def handle_webhook(self, data: dict, db: AsyncSession):
        """Processa notificação do Mercado Pago."""
        if data.get("type") == "payment":
            payment_id = data.get("data", {}).get("id")
            if payment_id:
                payment_info = self._sdk.payment().get(payment_id)["response"]
                tenant_id = int(payment_info.get("external_reference", 0))
                status    = payment_info.get("status")
                amount    = payment_info.get("transaction_amount", 0)

                if status == "approved":
                    tenant = await db.get(Tenant, tenant_id)
                    if tenant:
                        tenant.status = "active"
                        db.add(Payment(
                            tenant_id=tenant_id, amount_brl=amount,
                            status="paid", payment_method="mercadopago",
                            external_id=str(payment_id), paid_at=datetime.utcnow(),
                        ))
                        await db.commit()


stripe_service = StripeService()
mp_service = MercadoPagoService()

# NetWatch SaaS — Guia de Deploy Completo

## O que foi construído

| Camada | O que faz |
|---|---|
| **Landing page** | Página pública com planos e cadastro auto-serviço |
| **Backend (FastAPI)** | API multi-tenant, coletores Mikrotik/EDD/Huawei, WebSocket |
| **Frontend (React)** | Dashboard por provedor com white-label |
| **Multi-tenant** | Cada provedor vê APENAS seus dados (tenant_id em tudo) |
| **Planos** | Starter R$97 · Pro R$197 · Enterprise R$397 |
| **Trial** | 14 dias grátis — sem cartão |
| **Cobrança** | Stripe (automático) ou Mercado Pago |
| **White-label** | Cada provedor define logo, cor e nome da plataforma |
| **Notificações** | WhatsApp + Telegram por tenant |
| **Super Admin** | Você gerencia todos os provedores |

---

## PASSO 1 — GitHub

```bash
# Extraia o zip, entre na pasta e rode:
git init
git add .
git commit -m "feat: NetWatch SaaS v1.0"
git remote add origin https://github.com/SEU_USUARIO/netwatch-saas.git
git push -u origin main
```

---

## PASSO 2 — Stripe (cobrança automática)

### 2.1 Criar conta
Acesse https://stripe.com/br e crie sua conta.

### 2.2 Criar os produtos
No Stripe Dashboard → **Products** → **Add product**:

Crie 3 produtos:
| Produto | Preço | Recorrência |
|---|---|---|
| NetWatch Starter | R$ 97,00 | Mensal |
| NetWatch Pro | R$ 197,00 | Mensal |
| NetWatch Enterprise | R$ 397,00 | Mensal |

Após criar cada produto, copie o **Price ID** (começa com `price_`).

### 2.3 Pegar as chaves
Dashboard → **Developers** → **API keys**:
- `STRIPE_SECRET_KEY` = a chave secreta (começa com `sk_live_`)

### 2.4 Configurar Webhook
Dashboard → **Developers** → **Webhooks** → **Add endpoint**:
- URL: `https://api.netwatch.cit.net.br/api/webhooks/stripe`
- Eventos para ouvir:
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.deleted`
- Copie o **Signing secret** → `STRIPE_WEBHOOK_SECRET`

---

## PASSO 3 — Coolify (deploy)

### 3.1 Adicionar o repo
Coolify → **New Resource** → **Docker Compose** → selecione o repo GitHub.

### 3.2 Variáveis de ambiente (copie e preencha)

```env
SECRET_KEY=<rode: python3 -c "import secrets; print(secrets.token_hex(32))">
POSTGRES_PASSWORD=<senha forte>

LANDING_URL=https://netwatch.cit.net.br
FRONTEND_URL=https://app.netwatch.cit.net.br
API_URL=https://api.netwatch.cit.net.br
WS_URL=wss://api.netwatch.cit.net.br/ws

TRIAL_DAYS=14

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

### 3.3 Domínios no Coolify

Configure 3 domínios, um para cada serviço:

| Container | Domínio |
|---|---|
| `netwatch-landing` | `netwatch.cit.net.br` |
| `netwatch-frontend` | `app.netwatch.cit.net.br` |
| `netwatch-backend` | `api.netwatch.cit.net.br` |

O Coolify configura SSL (Let's Encrypt) automaticamente.

### 3.4 Deploy
Clique **Deploy** e aguarde 2-3 minutos.

---

## PASSO 4 — Primeiro acesso (Super Admin)

Acesse `https://app.netwatch.cit.net.br` e faça login:

```
Email:  clebson@cit.net.br
Senha:  citmax2024
```

**Troque a senha imediatamente em Configurações!**

O tenant CITmax é criado automaticamente com plano Enterprise.

---

## PASSO 5 — Rotas importantes

| URL | O que é |
|---|---|
| `https://netwatch.cit.net.br` | Landing page para novos provedores |
| `https://app.netwatch.cit.net.br` | Painel dos provedores |
| `https://api.netwatch.cit.net.br/docs` | Documentação da API (Swagger) |

---

## Como um novo provedor se cadastra

1. Acessa `netwatch.cit.net.br`
2. Escolhe o plano → clica "Começar grátis"
3. Preenche nome, email, senha
4. **14 dias de trial começam automaticamente** — sem cartão
5. Entra no painel e já pode cadastrar dispositivos
6. Antes do trial acabar → Configurações → Plano → paga com cartão via Stripe

---

## Super Admin — Ver todos os provedores

Use o endpoint diretamente por enquanto (interface será adicionada no v1.1):

```bash
# Pegar token super admin (substitua pela senha correta)
curl -X POST https://api.netwatch.cit.net.br/api/auth/token \
  -d "username=clebson@cit.net.br&password=SUA_SENHA"

# Listar todos os tenants
curl https://api.netwatch.cit.net.br/api/superadmin/tenants \
  -H "Authorization: Bearer SEU_TOKEN"

# Suspender um tenant
curl -X PUT https://api.netwatch.cit.net.br/api/superadmin/tenants/5/suspend \
  -H "Authorization: Bearer SEU_TOKEN"

# Mudar plano de um tenant
curl -X PUT https://api.netwatch.cit.net.br/api/superadmin/tenants/5/plan/pro \
  -H "Authorization: Bearer SEU_TOKEN"

# Ver estatísticas gerais
curl https://api.netwatch.cit.net.br/api/superadmin/stats \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## White-label por provedor

Cada provedor acessa **Configurações → Identidade Visual** e define:
- Logo (URL de imagem)
- Cor principal (hex)
- Nome da plataforma

As cores e logo são aplicadas imediatamente no painel deles.

---

## Próximas evoluções (v1.1)

- [ ] Painel Super Admin visual (interface gráfica)
- [ ] E-mail de boas-vindas no cadastro (SendGrid)
- [ ] Relatórios PDF mensais por tenant
- [ ] App mobile (React Native)
- [ ] Integração Pix (Mercado Pago)
- [ ] Subdomain por tenant (`citmax.netwatch.com.br`)

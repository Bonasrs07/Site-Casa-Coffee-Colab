# Edge Functions — Casa Coffee Colab (Stripe · Fase 6a + 6b)

Três functions (Supabase, Deno) + a lib compartilhada:

```
supabase/functions/
├── _shared/lib.ts             # Stripe, Supabase service_role, CORS, JWT, getSiteUrl(),
│                              # ensureStripeCustomer, computeCartFromDb, getUserTierDiscount
├── create-checkout-session/   # Checkout: assinatura {tier_slug} OU loja {items}; exige JWT
├── create-portal-session/     # Billing Portal da assinatura; exige JWT
└── stripe-webhook/            # eventos do Stripe; verifica assinatura + idempotência
```

> **SÓ TEST MODE nesta fase.** Chaves `sk_test_…` / `whsec_…` de test. O código é
> **agnóstico de ambiente** — no go-live troca só os secrets (test → live). Ver o
> checklist de go-live no `CLAUDE.md`.

## Regras de segredo (relembrando)

Estes vivem **só** nas env vars da function (`supabase secrets`), **nunca** no
client/bundle/repo:

- `STRIPE_SECRET_KEY` — `sk_test_…`
- `STRIPE_WEBHOOK_SECRET` — `whsec_…` (vem ao cadastrar o endpoint do webhook)
- `SITE_URL` — base das `success_url`/`cancel_url` (dev: `http://localhost:5173`)

Já injetados pelo Supabase (não precisa setar): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

No **client** vai só `VITE_STRIPE_PUBLISHABLE_KEY` (`pk_test_…`) no `.env` — nunca aqui.

## Pré-requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e logado (`supabase login`).
- Projeto linkado: `supabase link --project-ref <SEU_PROJECT_REF>`.

## 1) Setar os secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set SITE_URL=http://localhost:5173
# o STRIPE_WEBHOOK_SECRET só existe DEPOIS de cadastrar o endpoint (passo 3) — setar então:
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx

# conferir:
supabase secrets list
```

## 2) Deploy das functions

```bash
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
# o webhook NÃO usa JWT (quem chama é o Stripe, autenticado pela assinatura):
supabase functions deploy stripe-webhook --no-verify-jwt
```

A URL do webhook fica:
`https://<SEU_PROJECT_REF>.functions.supabase.co/stripe-webhook`

## 3) Cadastrar o endpoint do webhook no Stripe (test)

Stripe Dashboard (**test mode**) → Developers → Webhooks → **Add endpoint**:

- **URL:** `https://<SEU_PROJECT_REF>.functions.supabase.co/stripe-webhook`
- **Eventos (assinatura — 6a):** `checkout.session.completed`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`.
- **Eventos (loja — 6b):** `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed` (Pix/Boleto confirmam/falham depois do
  checkout; cartão já fecha no `checkout.session.completed`).

Copie o **Signing secret** (`whsec_…`) e rode o `supabase secrets set STRIPE_WEBHOOK_SECRET=…`
do passo 1 (depois **re-deploy** o webhook pra pegar o secret novo:
`supabase functions deploy stripe-webhook --no-verify-jwt`).

## 3b) Habilitar Pix e Boleto (loja) — só painel, ZERO código

Stripe Dashboard (**test mode**) → Settings → **Payment methods** → habilite
**Pix** e **Boleto** (cartão já vem ligado). O Checkout usa automaticamente os
métodos habilitados (a function não fixa a lista). Pix/Boleto exigem moeda BRL
(já é o caso). No go-live, repita isso na conta **live**.

## 4) Testar o webhook local (opcional, com Stripe CLI)

```bash
stripe listen --forward-to https://<SEU_PROJECT_REF>.functions.supabase.co/stripe-webhook
# o `stripe listen` imprime um whsec_ próprio pra usar enquanto testa localmente
```

## Logs

```bash
supabase functions logs create-checkout-session
supabase functions logs create-portal-session
supabase functions logs stripe-webhook
```

## Sequência completa (resumo)

1. `node scripts/stripe-seed.mjs` → cria produtos/preços test, imprime os `price_id`.
2. Cole os `price_id` no bloco de `UPDATE`s da `supabase/migrations/0006_stripe.sql`
   e rode a migration no **SQL Editor**. Rode também a **`0007_orders_stripe.sql`** (loja).
3. `supabase secrets set` de `STRIPE_SECRET_KEY` e `SITE_URL`.
4. `supabase functions deploy` das **três** functions (webhook com `--no-verify-jwt`).
5. Cadastre o endpoint do webhook no Stripe (test) com os eventos de assinatura **e**
   de loja, pegue o `whsec_` e `supabase secrets set STRIPE_WEBHOOK_SECRET=…` →
   re-deploy do webhook.
6. (Loja) Habilite **Pix** e **Boleto** em Settings → Payment methods.
7. No client: `.env` com `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_…` (e o resto do Supabase).

## Como testar (test mode)

**Assinatura (6a):** logado, em `/planos` clica "assinar" → Checkout → cartão
**4242 4242 4242 4242** (validade futura / CVC / CEP quaisquer) → volta pra
checkout-sucesso. Confere `subscriptions` + `profiles.tier_slug` no banco.

**Loja (6b):**
- Adiciona itens ao carrinho, abre o drawer, "finalizar compra".
  - Deslogado → vai pro login e volta pro carrinho (`?cart=open`).
  - Logado → Checkout do Stripe.
- **Cartão:** `4242 4242 4242 4242` → aprova na hora. O `checkout.session.completed`
  cria a `orders` (status `pago`) + `order_items`. Confere no banco.
- **Boleto (test):** escolhe Boleto no Checkout → o `completed` cria a order como
  `pendente`; pra confirmar, no Dashboard test o boleto tem botão de simular
  pagamento (ou via Stripe CLI). Aí o `async_payment_succeeded` vira `pago`.
- **Pix (test):** escolhe Pix → QR de teste; no test mode o Dashboard/CLI permite
  simular a confirmação → `async_payment_succeeded` → `pago`.
- **Desconto do tier:** com uma assinatura ATIVA, o total no Checkout já vem com o
  `discount_percent` do tier (linha "-X%"). Sem assinatura = 0%. Confere que
  `orders.desconto_centavos`/`total_centavos` batem com o cobrado.

**Billing portal:** no perfil, "gerenciar assinatura" → Billing Portal do Stripe
(cancelar/atualizar cartão) → volta pro perfil.

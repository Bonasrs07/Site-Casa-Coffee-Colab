# Edge Functions — Casa Coffee Colab (Stripe · Fase 6a)

Duas functions (Supabase, Deno) + a lib compartilhada:

```
supabase/functions/
├── _shared/lib.ts             # Stripe, Supabase service_role, CORS, JWT, getSiteUrl()
├── create-checkout-session/   # cria Checkout Session (assinatura); exige JWT
└── stripe-webhook/            # recebe eventos do Stripe; verifica assinatura + idempotência
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
# o webhook NÃO usa JWT (quem chama é o Stripe, autenticado pela assinatura):
supabase functions deploy stripe-webhook --no-verify-jwt
```

A URL do webhook fica:
`https://<SEU_PROJECT_REF>.functions.supabase.co/stripe-webhook`

## 3) Cadastrar o endpoint do webhook no Stripe (test)

Stripe Dashboard (**test mode**) → Developers → Webhooks → **Add endpoint**:

- **URL:** `https://<SEU_PROJECT_REF>.functions.supabase.co/stripe-webhook`
- **Eventos:** `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`.

Copie o **Signing secret** (`whsec_…`) e rode o `supabase secrets set STRIPE_WEBHOOK_SECRET=…`
do passo 1 (depois **re-deploy** o webhook pra pegar o secret novo:
`supabase functions deploy stripe-webhook --no-verify-jwt`).

## 4) Testar o webhook local (opcional, com Stripe CLI)

```bash
stripe listen --forward-to https://<SEU_PROJECT_REF>.functions.supabase.co/stripe-webhook
# o `stripe listen` imprime um whsec_ próprio pra usar enquanto testa localmente
```

## Logs

```bash
supabase functions logs create-checkout-session
supabase functions logs stripe-webhook
```

## Sequência completa (resumo)

1. `node scripts/stripe-seed.mjs` → cria produtos/preços test, imprime os `price_id`.
2. Cole os `price_id` no bloco de `UPDATE`s da `supabase/migrations/0006_stripe.sql`
   e rode a migration no **SQL Editor**.
3. `supabase secrets set` de `STRIPE_SECRET_KEY` e `SITE_URL`.
4. `supabase functions deploy` das duas functions (webhook com `--no-verify-jwt`).
5. Cadastre o endpoint do webhook no Stripe (test), pegue o `whsec_` e
   `supabase secrets set STRIPE_WEBHOOK_SECRET=…` → re-deploy do webhook.
6. No client: `.env` com `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_…` (e o resto do Supabase).
7. Teste com o cartão **4242 4242 4242 4242** (qualquer validade futura / CVC / CEP).

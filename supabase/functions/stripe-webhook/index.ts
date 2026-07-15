// =============================================================================
// Casa Coffee Colab — stripe-webhook (Edge Function, Deno)
// Recebe os eventos do Stripe e mantém subscriptions/profiles em dia.
//
// SEGURANÇA (ver CLAUDE.md › Segurança):
//   • SEMPRE verifica a assinatura do Stripe (STRIPE_WEBHOOK_SECRET) — corpo cru.
//   • Idempotência/anti-replay: checa stripe_events pelo event.id; se já
//     processou, responde 200 e sai. Grava o event.id ao final (após sucesso),
//     então uma entrega que falhou é reprocessada na retentativa do Stripe.
//   • Escrita via service_role (ignora RLS).
//   • Comportamento idêntico em test e live — muda só o whsec (secrets).
//
// NÃO precisa de JWT (quem chama é o Stripe, autenticado pela assinatura).
// Não precisa de verify_jwt — desligue no deploy (--no-verify-jwt).
// =============================================================================

import { Stripe, stripe, supabaseAdmin, requireEnv } from '../_shared/lib.ts';

const WEBHOOK_SECRET = requireEnv('STRIPE_WEBHOOK_SECRET');

// Mapeia o status do Stripe pro enum do banco (trial|ativa|pausada|cancelada).
function mapStatus(s: Stripe.Subscription.Status): string {
  switch (s) {
    case 'active':
      return 'ativa';
    case 'trialing':
      return 'trial';
    case 'past_due':
    case 'incomplete':
    case 'paused':
      return 'pausada';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'cancelada';
    default:
      return 'pausada';
  }
}

const contaComoAtiva = (statusBanco: string) => statusBanco === 'ativa' || statusBanco === 'trial';

// Resolve o user_id do Supabase a partir da metadata da assinatura ou do Customer.
async function resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = sub.metadata?.user_id;
  if (fromMeta) return fromMeta;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.id ?? null;
}

// Resolve o tier_slug: metadata da assinatura ou lookup pelo price → tiers.
async function resolveTierSlug(sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = sub.metadata?.tier_slug;
  if (fromMeta) return fromMeta;
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (!priceId) return null;
  const { data } = await supabaseAdmin
    .from('tiers')
    .select('slug')
    .eq('stripe_price_id', priceId)
    .maybeSingle();
  return data?.slug ?? null;
}

// Upsert idempotente da assinatura + espelha o tier_slug ativo no profiles.
async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserId(sub);
  const tierSlug = await resolveTierSlug(sub);
  if (!userId) {
    console.warn('[stripe-webhook] assinatura sem user_id resolvível:', sub.id);
    return;
  }

  const statusBanco = mapStatus(sub.status);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  // current_period_end: no nível da assinatura (APIs antigas) OU do item (basil 2025+).
  // Lê o que existir — robusto às duas versões de API.
  // deno-lint-ignore no-explicit-any
  const anySub = sub as any;
  const periodEndUnix =
    anySub.current_period_end ?? anySub.items?.data?.[0]?.current_period_end ?? null;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

  // onConflict em stripe_subscription_id (UNIQUE na 0006) → uma linha por assinatura.
  const { error: upErr } = await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      tier_slug: tierSlug ?? undefined, // tier_slug é NOT NULL; se não resolveu, não sobrescreve
      status: statusBanco,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' },
  );
  if (upErr) throw upErr;

  // profiles.tier_slug: assinatura ativa/trial → o tier; senão → limpa (null).
  const novoTier = contaComoAtiva(statusBanco) ? (tierSlug ?? null) : null;
  const { error: profErr } = await supabaseAdmin
    .from('profiles')
    .update({ tier_slug: novoTier })
    .eq('id', userId);
  if (profErr) throw profErr;

  // TODO (Fase 3): creditar PONTOS de assinatura aqui (points_ledger append-only,
  // idempotente por event.id). Agora NÃO — só assinatura/tier nesta leva.
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('método não permitido', { status: 405 });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('sem assinatura', { status: 400 });

  const payload = await req.text(); // corpo CRU (obrigatório pra verificar a assinatura)

  // 1) Verifica a assinatura (async: o Deno usa SubtleCrypto).
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] assinatura inválida:', (err as Error).message);
    return new Response('assinatura inválida', { status: 400 });
  }

  // 2) Idempotência: se o event.id já foi processado, sai com 200.
  const { data: jaVisto } = await supabaseAdmin
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();
  if (jaVisto) return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });

  // 3) Processa os eventos de assinatura.
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const subId =
            typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        // Evento que não tratamos: ignora (mas registra como visto pra não voltar).
        break;
    }
  } catch (err) {
    // Falhou o processamento → NÃO grava stripe_events; o Stripe reenvia e a gente
    // reprocessa (a idempotência protege contra duplicar). Responde 500.
    console.error(`[stripe-webhook] erro processando ${event.type} (${event.id}):`, err);
    return new Response('erro ao processar', { status: 500 });
  }

  // 4) Marca o event.id como processado (idempotência).
  const { error: insErr } = await supabaseAdmin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type });
  // Corrida rara (duas entregas simultâneas): outra instância já inseriu → ok, é idempotente.
  if (insErr && insErr.code !== '23505') {
    console.error('[stripe-webhook] falha ao registrar event.id:', insErr);
    return new Response('erro ao registrar evento', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});

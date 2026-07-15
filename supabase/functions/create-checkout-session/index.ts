// =============================================================================
// Casa Coffee Colab — create-checkout-session (Edge Function, Deno)
// Cria uma Stripe Checkout Session no modo ASSINATURA pra um tier.
//
// SEGURANÇA (ver CLAUDE.md › Segurança):
//   • Verifica o JWT do usuário logado — só autenticado cria checkout.
//   • NUNCA confia em preço vindo do client: lê o tier e o stripe_price_id do
//     BANCO pelo tier_slug.
//   • success_url/cancel_url montadas server-side a partir de SITE_URL (env).
//   • Comportamento idêntico em test e live — muda só a chave (secrets).
//
// Recebe: { tier_slug: 'bronze'|'prata'|'ouro'|'diamante' }
// Retorna: { url } — o front redireciona pro Checkout do Stripe.
// =============================================================================

import {
  stripe,
  supabaseAdmin,
  handleCors,
  jsonResponse,
  getUserFromRequest,
  getSiteUrl,
} from '../_shared/lib.ts';

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  if (req.method !== 'POST') return jsonResponse({ error: 'método não permitido' }, 405);

  // 1) Só usuário autenticado (JWT válido).
  const user = await getUserFromRequest(req);
  if (!user) return jsonResponse({ error: 'não autenticado' }, 401);

  // 2) Body → tier_slug.
  let tier_slug: unknown;
  try {
    ({ tier_slug } = await req.json());
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }
  if (typeof tier_slug !== 'string' || !tier_slug) {
    return jsonResponse({ error: 'tier_slug obrigatório' }, 400);
  }

  // 3) Preço vem do BANCO (nunca do client). Só tier ativo com price cadastrado.
  const { data: tier, error: tierErr } = await supabaseAdmin
    .from('tiers')
    .select('slug, nome, stripe_price_id, ativo')
    .eq('slug', tier_slug)
    .maybeSingle();

  if (tierErr) return jsonResponse({ error: 'erro ao buscar o plano' }, 500);
  if (!tier || !tier.ativo) return jsonResponse({ error: 'plano indisponível' }, 400);
  if (!tier.stripe_price_id) {
    return jsonResponse({ error: 'plano ainda não tem preço configurado' }, 400);
  }

  try {
    // 4) Customer do Stripe: reusa o do profiles ou cria e persiste.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // 5) Checkout Session (assinatura). URLs montadas server-side a partir de SITE_URL.
    const site = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: tier.stripe_price_id, quantity: 1 }],
      client_reference_id: user.id,
      // metadata na assinatura pra o webhook resolver user_id/tier sem depender do client.
      subscription_data: { metadata: { user_id: user.id, tier_slug: tier.slug } },
      metadata: { user_id: user.id, tier_slug: tier.slug },
      allow_promotion_codes: true,
      success_url: `${site}/pages/checkout-sucesso.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/pages/checkout-cancelado.html`,
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error('[create-checkout-session]', err);
    return jsonResponse({ error: 'não deu pra iniciar o checkout agora' }, 500);
  }
});

// =============================================================================
// Casa Coffee Colab — supabase/functions/_shared/lib.ts
// Fundação compartilhada das Edge Functions (Deno). Ver CLAUDE.md › Segurança.
//
// Segredos vivem SÓ nas env vars da function (supabase secrets), NUNCA no
// client/bundle/repo:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SITE_URL  → setados por nós.
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY             → injetados pelo Supabase.
//
// Código AGNÓSTICO DE AMBIENTE: o comportamento é idêntico em test e live —
// muda só a chave (sk_test/whsec_test ↔ sk_live/whsec_live) via secrets. Nada
// de "if test/if live" no código.
// =============================================================================

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.6';

// --- Env obrigatória (falha alto e cedo se faltar) ---------------------------
export function requireEnv(nome: string): string {
  const v = Deno.env.get(nome);
  if (!v) throw new Error(`env ausente: ${nome} (setar via supabase secrets set)`);
  return v;
}

// --- Stripe (chave secreta da env) -------------------------------------------
// httpClient de fetch é obrigatório no Deno (o default do SDK usa Node http).
export const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
  httpClient: Stripe.createFetchHttpClient(),
});

// --- Supabase admin (service_role — ignora RLS; escrita server-side) ---------
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados no ambiente da function.
export const supabaseAdmin = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// --- CORS --------------------------------------------------------------------
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Responde o preflight OPTIONS; retorna null pros demais métodos (segue o fluxo).
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return null;
}

// --- Resposta JSON (sempre com CORS) -----------------------------------------
export function jsonResponse(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

// --- Auth: valida o JWT do Authorization header e retorna o user -------------
// Verifica a assinatura/validade do token via GoTrue (auth.getUser(jwt)). Só
// usuário autenticado passa. O PAPEL (role) nunca vem do token — quem precisar
// lê do profiles (banco). Retorna null se não houver token válido.
export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// --- Base URL do site (montada server-side; nunca vinda do client) -----------
// success_url/cancel_url do checkout saem daqui. Idêntico em test e live —
// muda só o valor de SITE_URL no secrets (dev: http://localhost:5173).
export function getSiteUrl(): string {
  return requireEnv('SITE_URL').replace(/\/+$/, ''); // sem barra final
}

// --- Stripe Customer do usuário (cria e persiste em profiles, ou reusa) -------
// Usado por create-checkout-session (assinatura e loja) e create-portal-session.
export async function ensureStripeCustomer(user: { id: string; email?: string | null }): Promise<string> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { supabase_user_id: user.id },
  });
  await supabaseAdmin.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id);
  return customer.id;
}

// =============================================================================
// CARRINHO — preço/validação SEMPRE do BANCO (nunca do client).
// O client manda só { product_slug, variant, qtd }. Aqui a gente busca o preço
// real em products/product_variants e soma o subtotal server-side. Ver CLAUDE.md
// › Segurança ("confiança zero no client").
// =============================================================================
export interface CartInputItem {
  product_slug: string;
  variant?: string | null; // opcao da product_variants (ex.: 'Moído p/ coado'), ou null
  qtd: number;
}
export interface CartLine {
  product_id: string;
  variant_id: string | null;
  product_slug: string;
  nome: string; // nome do produto (snapshot)
  variant_opcao: string | null; // opcao crua (pra resolver depois)
  variante_label: string | null; // 'Moagem: Moído p/ coado' (exibição/snapshot)
  unit_cents: number; // preço unitário já com delta da variante
  qtd: number;
}

export async function computeCartFromDb(
  items: CartInputItem[],
): Promise<{ lines: CartLine[]; subtotal_cents: number }> {
  if (!Array.isArray(items) || items.length === 0) throw new Error('carrinho vazio');
  if (items.length > 50) throw new Error('carrinho grande demais');

  const lines: CartLine[] = [];
  let subtotal = 0;

  for (const it of items) {
    const slug = String(it?.product_slug ?? '').trim();
    const qtd = Number(it?.qtd);
    if (!slug) throw new Error('item sem product_slug');
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 99) throw new Error('quantidade inválida');

    const { data: prod, error } = await supabaseAdmin
      .from('products')
      .select('id, slug, nome, preco_centavos, ativo')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error('erro ao ler produto');
    if (!prod || !prod.ativo) throw new Error(`produto indisponível: ${slug}`);

    let unit = prod.preco_centavos;
    let variantId: string | null = null;
    let variantOpcao: string | null = null;
    let variantLabel: string | null = null;

    const opcao = it?.variant ? String(it.variant).trim() : '';
    if (opcao) {
      const { data: v } = await supabaseAdmin
        .from('product_variants')
        .select('id, rotulo, opcao, preco_delta_centavos, ativo')
        .eq('product_id', prod.id)
        .eq('opcao', opcao)
        .maybeSingle();
      if (!v || !v.ativo) throw new Error(`opção indisponível: ${opcao}`);
      variantId = v.id;
      variantOpcao = v.opcao;
      variantLabel = v.rotulo ? `${v.rotulo}: ${v.opcao}` : v.opcao;
      unit += v.preco_delta_centavos ?? 0;
    }

    subtotal += unit * qtd;
    lines.push({
      product_id: prod.id,
      variant_id: variantId,
      product_slug: prod.slug,
      nome: prod.nome,
      variant_opcao: variantOpcao,
      variante_label: variantLabel,
      unit_cents: unit,
      qtd,
    });
  }

  return { lines, subtotal_cents: subtotal };
}

// Desconto do tier ATIVO do usuário (profiles.tier_slug → tiers.discount_percent).
// Sem assinatura ativa = 0%. Nunca vem do client.
export async function getUserTierDiscount(
  userId: string,
): Promise<{ tier_slug: string | null; discount_percent: number }> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('tier_slug')
    .eq('id', userId)
    .maybeSingle();
  const slug = profile?.tier_slug ?? null;
  if (!slug) return { tier_slug: null, discount_percent: 0 };

  const { data: tier } = await supabaseAdmin
    .from('tiers')
    .select('slug, discount_percent, ativo')
    .eq('slug', slug)
    .maybeSingle();
  if (!tier || !tier.ativo) return { tier_slug: null, discount_percent: 0 };

  const pct = Number(tier.discount_percent ?? 0);
  return { tier_slug: tier.slug, discount_percent: pct > 0 && pct <= 100 ? pct : 0 };
}

export { Stripe };

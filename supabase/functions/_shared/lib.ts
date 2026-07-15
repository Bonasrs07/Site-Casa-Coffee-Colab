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

export { Stripe };

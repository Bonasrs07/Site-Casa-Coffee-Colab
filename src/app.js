// =============================================================================
// Casa Coffee Colab — app.js
// Camada de interface (JS vanilla). Um arquivo por camada — ver CLAUDE.md.
//
// Header, footer e menu são funções que injetam HTML nos placeholders da página:
//   <div id="site-header"></div>  /  <div id="site-footer"></div>
// Cada página .html é uma URL própria; ela chama initSite() no fim.
// =============================================================================

import './styles.css';
import {
  createIcons,
  Coffee,
  Sunrise,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Music,
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Heart,
  Sparkles,
  Hand,
  Award,
  Star,
  Gift,
  Mail,
  MessageCircle,
  User,
  LogOut,
} from 'lucide';
import { createClient } from '@supabase/supabase-js';

// Ícones Lucide usados no site. createIcons() substitui <i data-lucide="..."> por SVG.
// Chamar sempre DEPOIS de injetar markup novo no DOM.
const LUCIDE_ICONS = {
  Coffee,
  Sunrise,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Music,
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Heart,
  Sparkles,
  Hand,
  Award,
  Star,
  Gift,
  Mail,
  MessageCircle,
  User,
  LogOut,
};
function renderIcons() {
  createIcons({ icons: LUCIDE_ICONS });
}

// --- Dados da marca (fonte única) ----------------------------------------------
const MARCA = {
  nome: 'Casa Coffee Colab',
  bio: 'O Casa é café, afeto e comida boa',
  cta: 'Entra, senta, fica um pouco',
  contato: {
    endereco: 'R. Victor Hugo Kunz, 411 — Hamburgo Velho, Novo Hamburgo/RS',
    email: 'casacoffeecolab@gmail.com',
    telefone: '(51) 99360-5262',
    telefoneHref: '+5551993605262',
    horario: 'Seg a sáb 8h–19h · dom 15h–19h',
  },
  redes: [
    { nome: 'Instagram', href: '#' },
    { nome: 'Facebook', href: '#' },
    { nome: 'Spotify', href: '#' },
  ],
};

// Navegação principal. Aponta pras páginas reais (cada uma é uma URL).
const NAV = [
  { rotulo: 'Home', href: '/pages/home.html' },
  { rotulo: 'O Casa', href: '/pages/o-casa.html' },
  { rotulo: 'Cardápio', href: '/pages/cardapio.html' },
  { rotulo: 'Loja', href: '/pages/loja.html' },
  { rotulo: 'Planos', href: '/pages/planos.html' },
  { rotulo: 'Colab', href: '/pages/colab.html' },
];

// Qual item da NAV corresponde à página atual (pra marcar como ativo).
// produto.html conta como "Loja"; a raiz "/" conta como "Home".
function activeNavHref() {
  const path = window.location.pathname;
  const base = path.substring(path.lastIndexOf('/') + 1) || 'home.html';
  if (base === '' || base === 'index.html') return '/pages/home.html';
  if (base === 'produto.html') return '/pages/loja.html';
  const found = NAV.find((item) => item.href.endsWith('/' + base));
  return found ? found.href : null;
}

// =============================================================================
// AUTH (Supabase Auth)
// Só a ANON key no client — a RLS do banco é quem protege os dados (ver CLAUDE.md).
// O papel (role) do usuário vem SEMPRE do profiles (banco), nunca do client.
// Sessão persiste no localStorage (padrão do supabase-js) e sobrevive à navegação.
// =============================================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseConfigurado =
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) &&
  !/placeholder/i.test(SUPABASE_URL);

// Client único (ou null se ainda não configurado — as telas degradam com aviso gentil).
export const supabase = supabaseConfigurado
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!supabaseConfigurado) {
  // Aviso só no console — nada de segredo, nada de quebrar a página.
  console.warn(
    '[Casa] Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.'
  );
}

// Escapa toda string vinda do banco/usuário antes de injetar no DOM (anti-XSS).
function escapeHtml(valor) {
  return String(valor ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// --- Helpers de sessão/perfil --------------------------------------------------
async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

// Lê a PRÓPRIA linha do profiles (RLS: id = auth.uid()). role vem daqui, não do client.
async function getProfile() {
  if (!supabase) return null;
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, telefone, role, points_balance, tier_slug')
    .eq('id', user.id)
    .single();
  if (error) return null;
  return data;
}

async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

// Base URL do site pra links de e-mail (confirmação/reset). Env-driven, sem
// hardcode: usa VITE_SITE_URL (dev e prod) e cai pro origin atual se não houver.
// (`||` e não `??` de propósito: trata VITE_SITE_URL="" como ausente.)
function siteBase() {
  return import.meta.env.VITE_SITE_URL || window.location.origin;
}

// Nome de exibição (metadata do signup > e-mail). Sempre escapado por quem injeta.
function nomeDeExibicao(session) {
  const u = session?.user;
  if (!u) return '';
  return u.user_metadata?.full_name || u.email || 'você';
}

// Traduz erros do Supabase pro tom da casa (sem vazar detalhe técnico).
function mensagemDeErroAuth(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'parece que esse e-mail já tem conta por aqui. tenta entrar? 💛';
  if (m.includes('invalid login credentials'))
    return 'o e-mail ou a senha não bateram. tenta de novo, com calma.';
  if (m.includes('email not confirmed'))
    return 'falta confirmar teu e-mail. dá uma olhada na tua caixa de entrada?';
  if (m.includes('password') && m.includes('at least'))
    return 'a senha precisa de pelo menos 8 caracteres.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'muitas tentativas seguidas. respira, toma um café e tenta daqui a pouco.';
  if (m.includes('failed to fetch') || m.includes('networkerror'))
    return 'a gente não conseguiu falar com o servidor agora. confere tua conexão?';
  return 'algo não saiu como esperado. tenta de novo daqui a pouco?';
}

// =============================================================================
// CATÁLOGO (MOCK — virá do Supabase na Fase 2)
// TODO: substituir este array pela tabela `products` do Supabase (ver CLAUDE.md).
// Cada produto: id, nome, slug, categoria, preco_centavos, descricao,
// imagemPlaceholder (classe .photo-*), variantes (opcional).
// =============================================================================
const CATEGORIAS = {
  vestuario: 'Vestuário',
  acessorios: 'Acessórios',
  cafe_grao: 'Café em grão',
};

const PRODUTOS = [
  {
    id: 'cafe-alma',
    nome: 'Café em grão · Alma do Casa · 250g',
    slug: 'cafe-alma-do-casa-250g',
    categoria: 'cafe_grao',
    preco_centavos: 4990,
    descricao:
      'Nosso blend autoral — encorpado, de final doce. Torrado em micro-lote pra chegar fresquinho na tua xícara.',
    imagemPlaceholder: 'photo-warm',
    variantes: { rotulo: 'Moagem', opcoes: ['Grão inteiro', 'Moído p/ coado', 'Moído p/ espresso'] },
  },
  {
    id: 'cafe-vale',
    nome: 'Café em grão · Torra Vale dos Sinos · 250g',
    slug: 'cafe-torra-vale-dos-sinos-250g',
    categoria: 'cafe_grao',
    preco_centavos: 5490,
    descricao:
      'Micro-lote de um produtor vizinho, com notas de castanha e caramelo. A gente serve por tempo limitado.',
    imagemPlaceholder: 'photo-green',
    variantes: { rotulo: 'Moagem', opcoes: ['Grão inteiro', 'Moído p/ coado', 'Moído p/ espresso'] },
  },
  {
    id: 'cafe-afeto',
    nome: 'Café em grão · Descafeinado Afeto · 250g',
    slug: 'cafe-descafeinado-afeto-250g',
    categoria: 'cafe_grao',
    preco_centavos: 5290,
    descricao:
      'Pra ficar um pouco mais sem perder o sono. Descafeinado suave, doce e redondo — no teu ritmo.',
    imagemPlaceholder: 'photo-bege',
    variantes: { rotulo: 'Moagem', opcoes: ['Grão inteiro', 'Moído p/ coado', 'Moído p/ espresso'] },
  },
  {
    id: 'moletom-casa',
    nome: 'Moletom Casa Coffee',
    slug: 'moletom-casa-coffee',
    categoria: 'vestuario',
    preco_centavos: 19990,
    descricao:
      'Quentinho pra vestir nos dias de café e chuva. Algodão macio, bordado discreto do Casa no peito.',
    imagemPlaceholder: 'photo-green',
    variantes: { rotulo: 'Tamanho', opcoes: ['P', 'M', 'G', 'GG'] },
  },
  {
    id: 'camiseta-feito',
    nome: 'Camiseta "feito no Casa"',
    slug: 'camiseta-feito-no-casa',
    categoria: 'vestuario',
    preco_centavos: 8990,
    descricao:
      'Leve, de algodão, com a nossa frase preferida estampada. Pra levar um pedacinho do Casa por aí.',
    imagemPlaceholder: 'photo-warm',
    variantes: { rotulo: 'Tamanho', opcoes: ['P', 'M', 'G', 'GG'] },
  },
  {
    id: 'avental-casa',
    nome: 'Avental do Casa',
    slug: 'avental-do-casa',
    categoria: 'vestuario',
    preco_centavos: 11990,
    descricao:
      'O mesmo avental que a gente usa na cozinha. Linho encorpado, bolso na frente, feito pra durar.',
    imagemPlaceholder: 'photo-bege',
    variantes: { rotulo: 'Tamanho', opcoes: ['Único'] },
  },
  {
    id: 'caneca-autor',
    nome: 'Caneca de autor',
    slug: 'caneca-de-autor',
    categoria: 'acessorios',
    preco_centavos: 5990,
    descricao:
      'Cerâmica feita à mão pelo Ateliê Lomba Grande, em residência com a gente. Cada peça é única.',
    imagemPlaceholder: 'photo-warm',
    variantes: null,
  },
  {
    id: 'bolsa-linho',
    nome: 'Bolsa de linho',
    slug: 'bolsa-de-linho',
    categoria: 'acessorios',
    preco_centavos: 7990,
    descricao:
      'Do tamanho certo pra um livro, o café e o resto do dia. Linho natural que envelhece bonito.',
    imagemPlaceholder: 'photo-green',
    variantes: null,
  },
  {
    id: 'ecobag-passa',
    nome: 'Ecobag "passa aqui?"',
    slug: 'ecobag-passa-aqui',
    categoria: 'acessorios',
    preco_centavos: 3990,
    descricao:
      'Nosso convite favorito, pra carregar junto. Algodão cru, alça reforçada, cabe a feira inteira.',
    imagemPlaceholder: 'photo-bege',
    variantes: null,
  },
  {
    id: 'kit-coador',
    nome: 'Kit coador + filtro de pano',
    slug: 'kit-coador-filtro-pano',
    categoria: 'acessorios',
    preco_centavos: 6990,
    descricao:
      'Pra fazer em casa o café que tu toma aqui. Suporte de madeira e filtro de pano reutilizável.',
    imagemPlaceholder: 'photo-warm',
    variantes: null,
  },
];

const getProdutoPorSlug = (slug) => PRODUTOS.find((p) => p.slug === slug) || null;
const getProdutoPorId = (id) => PRODUTOS.find((p) => p.id === id) || null;

// Preço em R$ (ex.: 4990 → "R$ 49,90")
function formatBRL(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// =============================================================================
// CARRINHO
// Estado persistido em localStorage (chave "casa_cart") — o site é multi-página,
// então o carrinho PRECISA sobreviver a reloads/navegação.
// Item guardado: { key, produtoId, variante, qtd }. `key` = produtoId::variante,
// pra somar o mesmo produto+variante e separar variantes diferentes.
// =============================================================================
const CART_KEY = 'casa_cart';
const cartListeners = new Set();

const Cart = {
  getCart() {
    try {
      const arr = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  },
  _save(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      /* localStorage indisponível (modo privado) — segue em memória da sessão */
    }
    cartListeners.forEach((fn) => fn(items));
  },
  addItem(produtoId, variante = null, qtd = 1) {
    if (!getProdutoPorId(produtoId)) return;
    const q = Math.max(1, parseInt(qtd, 10) || 1);
    const key = `${produtoId}::${variante || ''}`;
    const items = this.getCart();
    const existente = items.find((it) => it.key === key);
    if (existente) existente.qtd += q;
    else items.push({ key, produtoId, variante: variante || null, qtd: q });
    this._save(items);
  },
  updateQty(key, qtd) {
    const q = parseInt(qtd, 10) || 0;
    let items = this.getCart();
    items = q <= 0 ? items.filter((it) => it.key !== key) : items.map((it) => (it.key === key ? { ...it, qtd: q } : it));
    this._save(items);
  },
  removeItem(key) {
    this._save(this.getCart().filter((it) => it.key !== key));
  },
  clearCart() {
    this._save([]);
  },
  getCount() {
    return this.getCart().reduce((n, it) => n + it.qtd, 0);
  },
  getSubtotalCentavos() {
    return this.getCart().reduce((sum, it) => {
      const p = getProdutoPorId(it.produtoId);
      return sum + (p ? p.preco_centavos * it.qtd : 0);
    }, 0);
  },
  onChange(fn) {
    cartListeners.add(fn);
    return () => cartListeners.delete(fn);
  },
};

// --- Header --------------------------------------------------------------------
function renderHeader() {
  const slot = document.getElementById('site-header');
  if (!slot) return;

  const ativo = activeNavHref();

  const linksDesktop = NAV.map((item) => {
    const isAtivo = item.href === ativo;
    return `<a href="${item.href}"${isAtivo ? ' aria-current="page"' : ''} class="transition-colors ${
      isAtivo ? 'font-semibold text-terracota' : 'text-cafe/80 hover:text-terracota'
    }">${item.rotulo}</a>`;
  }).join('');

  const linksMobile = NAV.map((item) => {
    const isAtivo = item.href === ativo;
    return `<a href="${item.href}"${isAtivo ? ' aria-current="page"' : ''} class="block py-3 text-lg transition-colors ${
      isAtivo ? 'font-semibold text-terracota' : 'text-cafe hover:text-terracota'
    }" data-menu-link>${item.rotulo}</a>`;
  }).join('');

  slot.innerHTML = `
    <header id="topo" class="fixed inset-x-0 top-0 z-50 transition-colors duration-300" data-site-header>
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 md:h-20 3xl:max-w-[1600px]">
        <!-- Logo -->
        <a href="#topo" class="flex items-center gap-2 shrink-0">
          <span class="font-titulo text-lg font-semibold text-terracota sm:text-xl">Casa Coffee Colab</span>
        </a>

        <!-- Nav desktop -->
        <nav class="hidden items-center gap-6 text-sm font-medium lg:flex" aria-label="Navegação principal">
          ${linksDesktop}
        </nav>

        <!-- CTA desktop -->
        <a href="/pages/cardapio.html" class="btn-primary hidden lg:inline-flex">${MARCA.cta}</a>

        <!-- Auth (desktop) — preenchido por updateAuthUI conforme a sessão -->
        <div class="hidden items-center lg:flex" data-auth-slot></div>

        <!-- Carrinho -->
        <button
          type="button"
          class="relative inline-flex items-center justify-center rounded-full p-2 text-cafe hover:bg-cafe/10"
          aria-label="Abrir carrinho"
          data-cart-toggle
        >
          <i data-lucide="shopping-bag" class="h-6 w-6"></i>
          <span
            class="absolute -right-0.5 -top-0.5 hidden min-w-[1.15rem] rounded-full bg-terracota px-1 text-center text-[0.7rem] font-semibold leading-[1.15rem] text-bege"
            data-cart-count
            aria-live="polite"
          >0</span>
        </button>

        <!-- Botão hambúrguer (mobile) -->
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full p-2 text-cafe hover:bg-cafe/10 lg:hidden"
          aria-label="Abrir menu"
          aria-expanded="false"
          aria-controls="menu-mobile"
          data-menu-toggle
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" data-icon-open />
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6" class="hidden" data-icon-close />
          </svg>
        </button>
      </div>

      <!-- Menu mobile (drawer) -->
      <div
        id="menu-mobile"
        class="hidden border-t border-cafe/10 bg-bege/95 backdrop-blur-md lg:hidden"
        data-menu-panel
      >
        <nav class="mx-auto max-w-7xl px-4 py-4 sm:px-6" aria-label="Navegação mobile">
          ${linksMobile}
          <a href="/pages/cardapio.html" class="btn-primary mt-4 w-full" data-menu-link>${MARCA.cta}</a>
          <!-- Auth (mobile) — preenchido por updateAuthUI conforme a sessão -->
          <div class="mt-4 border-t border-cafe/10 pt-4" data-auth-slot-mobile></div>
        </nav>
      </div>
    </header>
  `;

  initHeaderInteractions();
}

function initHeaderInteractions() {
  const header = document.querySelector('[data-site-header]');
  const toggle = document.querySelector('[data-menu-toggle]');
  const panel = document.querySelector('[data-menu-panel]');
  const iconOpen = document.querySelector('[data-icon-open]');
  const iconClose = document.querySelector('[data-icon-close]');

  // Blur + fundo ao rolar
  if (header) {
    const aplicarScroll = () => {
      const rolou = window.scrollY > 8;
      header.classList.toggle('bg-bege/80', rolou);
      header.classList.toggle('backdrop-blur-md', rolou);
      header.classList.toggle('shadow-sm', rolou);
      header.classList.toggle('shadow-cafe/5', rolou);
    };
    aplicarScroll();
    window.addEventListener('scroll', aplicarScroll, { passive: true });
  }

  // Menu hambúrguer
  if (toggle && panel) {
    const fechar = () => {
      panel.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu');
      iconOpen?.classList.remove('hidden');
      iconClose?.classList.add('hidden');
    };
    const abrir = () => {
      panel.classList.remove('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Fechar menu');
      iconOpen?.classList.add('hidden');
      iconClose?.classList.remove('hidden');
    };
    toggle.addEventListener('click', () => {
      const aberto = toggle.getAttribute('aria-expanded') === 'true';
      aberto ? fechar() : abrir();
    });
    // Fecha ao clicar num link ou apertar Esc
    panel.querySelectorAll('[data-menu-link]').forEach((el) =>
      el.addEventListener('click', fechar)
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fechar();
    });
  }
}

// --- Footer --------------------------------------------------------------------
function renderFooter() {
  const slot = document.getElementById('site-footer');
  if (!slot) return;

  const { contato, redes } = MARCA;

  const linksNav = NAV.map(
    (item) =>
      `<li><a href="${item.href}" class="text-bege/80 hover:text-bege transition-colors">${item.rotulo}</a></li>`
  ).join('');

  const linksRedes = redes
    .map(
      (r) =>
        `<a href="${r.href}" class="text-bege/80 hover:text-bege transition-colors" aria-label="${r.nome}">${r.nome}</a>`
    )
    .join('');

  slot.innerHTML = `
    <footer class="bg-cafe text-bege">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:py-16 3xl:max-w-[1600px]">
        <!-- Bio -->
        <div class="sm:col-span-2 lg:col-span-1">
          <p class="font-titulo text-xl text-bege">Casa Coffee Colab</p>
          <p class="mt-3 font-decor text-2xl text-caramelo">${MARCA.bio}</p>
        </div>

        <!-- Navegação -->
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-bege/60">Por aqui</h3>
          <ul class="mt-4 space-y-2 text-sm">${linksNav}</ul>
        </div>

        <!-- Contato -->
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-bege/60">A gente te espera</h3>
          <address class="mt-4 space-y-2 text-sm not-italic text-bege/80">
            <p>${contato.endereco}</p>
            <p><a href="mailto:${contato.email}" class="hover:text-bege transition-colors">${contato.email}</a></p>
            <p><a href="tel:${contato.telefoneHref}" class="hover:text-bege transition-colors">${contato.telefone}</a></p>
            <p>${contato.horario}</p>
          </address>
        </div>

        <!-- Redes -->
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-bege/60">Cola com a gente</h3>
          <div class="mt-4 flex flex-col gap-2 text-sm">${linksRedes}</div>
        </div>
      </div>

      <div class="border-t border-bege/10">
        <div class="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-bege/50 sm:flex-row sm:items-center sm:justify-between sm:px-6 3xl:max-w-[1600px]">
          <p>© ${new Date().getFullYear()} Casa Coffee Colab · feito com afeto em Novo Hamburgo/RS</p>
          <p class="font-decor text-base text-caramelo">passa aqui?</p>
        </div>
      </div>
    </footer>
  `;
}

// =============================================================================
// DRAWER DO CARRINHO — painel lateral reutilizável (qualquer página).
// Injetado uma vez no <body>. Fecha por X, Esc e clique no backdrop.
// Anima com transições CSS (zeradas por prefers-reduced-motion no styles.css).
// =============================================================================
function renderDrawer() {
  if (document.querySelector('[data-drawer-root]')) return; // injeta uma vez só
  const el = document.createElement('div');
  el.innerHTML = `
    <div data-drawer-root class="fixed inset-0 z-[60] hidden" aria-hidden="true">
      <div data-drawer-backdrop class="absolute inset-0 bg-preto/50 opacity-0 transition-opacity duration-300"></div>
      <aside
        data-drawer-panel
        role="dialog"
        aria-modal="true"
        aria-label="Teu carrinho"
        class="absolute right-0 top-0 flex h-full w-full max-w-sm translate-x-full flex-col bg-bege shadow-2xl transition-transform duration-300"
      >
        <header class="flex items-center justify-between border-b border-cafe/10 px-5 py-4">
          <p class="font-titulo text-lg">Teu carrinho</p>
          <button type="button" data-drawer-close aria-label="Fechar carrinho" class="rounded-full p-1.5 text-cafe hover:bg-cafe/10">
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
        </header>
        <div data-cart-items class="flex-1 overflow-y-auto px-5"></div>
        <footer data-cart-footer class="hidden border-t border-cafe/10 px-5 py-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-cafe/70">subtotal</span>
            <span class="font-titulo text-lg" data-cart-subtotal>R$ 0,00</span>
          </div>
          <button type="button" data-checkout class="btn-primary mt-4 w-full">finalizar compra</button>
          <p class="mt-3 hidden text-center text-xs text-cafe/70" data-checkout-note>
            o checkout chega na próxima fase — o pagamento via Stripe vem aí. por ora, fica um pouco. 💛
          </p>
        </footer>
      </aside>
    </div>
  `;
  document.body.appendChild(el.firstElementChild);
}

// Redesenha badge + conteúdo do drawer a partir do estado do Cart.
function updateCartUI() {
  const count = Cart.getCount();

  // Badge
  const badge = document.querySelector('[data-cart-count]');
  if (badge) {
    badge.textContent = String(count);
    badge.classList.toggle('hidden', count === 0);
  }

  const wrap = document.querySelector('[data-cart-items]');
  const footer = document.querySelector('[data-cart-footer]');
  if (!wrap || !footer) return;

  const items = Cart.getCart();
  if (items.length === 0) {
    wrap.innerHTML = `
      <div class="py-16 text-center">
        <p class="decor text-2xl">teu carrinho tá vazio</p>
        <p class="mx-auto mt-2 max-w-[16rem] text-sm text-cafe/60">passa na loja e leva junto o que te agradar, no teu ritmo.</p>
        <a href="/pages/loja.html" class="btn-primary mt-6">ver a loja</a>
      </div>`;
    footer.classList.add('hidden');
    renderIcons();
    return;
  }

  wrap.innerHTML = items
    .map((it) => {
      const p = getProdutoPorId(it.produtoId);
      if (!p) return '';
      return `
      <div class="flex gap-3 border-b border-cafe/10 py-4" data-cart-row data-key="${it.key}">
        <div class="${p.imagemPlaceholder} h-16 w-16 shrink-0 rounded-lg"></div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-cafe">${p.nome}</p>
          ${it.variante ? `<p class="text-xs text-cafe/60">${it.variante}</p>` : ''}
          <div class="mt-2 flex items-center justify-between gap-2">
            <div class="inline-flex items-center rounded-full border border-cafe/20">
              <button type="button" data-cart-dec aria-label="Diminuir quantidade" class="grid h-7 w-7 place-items-center text-cafe hover:text-terracota">
                <i data-lucide="minus" class="h-4 w-4"></i>
              </button>
              <span class="w-7 text-center text-sm" data-cart-qty>${it.qtd}</span>
              <button type="button" data-cart-inc aria-label="Aumentar quantidade" class="grid h-7 w-7 place-items-center text-cafe hover:text-terracota">
                <i data-lucide="plus" class="h-4 w-4"></i>
              </button>
            </div>
            <span class="text-sm font-medium text-cafe">${formatBRL(p.preco_centavos * it.qtd)}</span>
          </div>
        </div>
        <button type="button" data-cart-remove aria-label="Remover do carrinho" class="self-start p-1 text-cafe/40 hover:text-terracota">
          <i data-lucide="trash-2" class="h-4 w-4"></i>
        </button>
      </div>`;
    })
    .join('');

  const subtotalEl = footer.querySelector('[data-cart-subtotal]');
  if (subtotalEl) subtotalEl.textContent = formatBRL(Cart.getSubtotalCentavos());
  footer.classList.remove('hidden');
  renderIcons();
}

function openDrawer() {
  const root = document.querySelector('[data-drawer-root]');
  if (!root) return;
  root.classList.remove('hidden');
  root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden');
  requestAnimationFrame(() => {
    root.querySelector('[data-drawer-backdrop]')?.classList.add('opacity-100');
    root.querySelector('[data-drawer-panel]')?.classList.remove('translate-x-full');
  });
  root.querySelector('[data-drawer-close]')?.focus();
}

function closeDrawer() {
  const root = document.querySelector('[data-drawer-root]');
  if (!root || root.classList.contains('hidden')) return;
  const backdrop = root.querySelector('[data-drawer-backdrop]');
  const panel = root.querySelector('[data-drawer-panel]');
  backdrop?.classList.remove('opacity-100');
  panel?.classList.add('translate-x-full');
  root.setAttribute('aria-hidden', 'true');
  const finish = () => {
    root.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) finish();
  else setTimeout(finish, 320); // acompanha a duração da transição
}

// Liga o carrinho: drawer, badge, eventos e persistência entre abas.
function initCart() {
  renderDrawer();

  // Abre pelo botão do header
  document.querySelector('[data-cart-toggle]')?.addEventListener('click', openDrawer);

  const root = document.querySelector('[data-drawer-root]');
  if (root) {
    root.querySelector('[data-drawer-close]')?.addEventListener('click', closeDrawer);
    root.querySelector('[data-drawer-backdrop]')?.addEventListener('click', closeDrawer);

    // Controles de quantidade / remover (delegação)
    root.querySelector('[data-cart-items]')?.addEventListener('click', (e) => {
      const row = e.target.closest('[data-cart-row]');
      if (!row) return;
      const key = row.getAttribute('data-key');
      const item = Cart.getCart().find((it) => it.key === key);
      if (!item) return;
      if (e.target.closest('[data-cart-inc]')) Cart.updateQty(key, item.qtd + 1);
      else if (e.target.closest('[data-cart-dec]')) Cart.updateQty(key, item.qtd - 1);
      else if (e.target.closest('[data-cart-remove]')) Cart.removeItem(key);
    });

    // Checkout — placeholder (Stripe vem na Fase 2)
    root.querySelector('[data-checkout]')?.addEventListener('click', () => {
      root.querySelector('[data-checkout-note]')?.classList.remove('hidden');
    });
  }

  // Fecha com Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Reage a mudanças do carrinho (nesta aba) e em outras abas
  Cart.onChange(updateCartUI);
  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) updateCartUI();
  });

  updateCartUI(); // estado inicial
}

// =============================================================================
// Carrossel reutilizável (scroll-snap) — serve pros 3 tracks da home.
//
// Contrato de DOM:
//   <div data-carousel="hero|cards">
//     <div data-carousel-track class="carousel-track">…slides…</div>
//     <div data-dots></div>                 (opcional — bolinhas)
//     <button data-carousel-prev>…</button> (opcional — desktop)
//     <button data-carousel-next>…</button> (opcional — desktop)
//   </div>
//
// setupCarousel(trackEl, { dots, autoplay, interval })
//   - autoplay só roda se NÃO for prefers-reduced-motion; pausa em hover/foco/toque.
//   - dots clicáveis refletem o slide atual (usado só no hero).
//   - navegável por teclado (setas) e por swipe/scroll no mobile.
// =============================================================================
function setupCarousel(trackEl, { dots = false, autoplay = false, interval = 5500 } = {}) {
  if (!trackEl) return;
  const slides = Array.from(trackEl.children);
  if (slides.length === 0) return;

  const root = trackEl.closest('[data-carousel]') || trackEl.parentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Torna o track acessível/foca­vel pra navegação por teclado
  if (!trackEl.hasAttribute('tabindex')) trackEl.setAttribute('tabindex', '0');
  if (!trackEl.hasAttribute('role')) trackEl.setAttribute('role', 'region');
  if (!trackEl.hasAttribute('aria-label')) trackEl.setAttribute('aria-label', 'Carrossel');

  // Posição (à esquerda) de cada slide, relativa ao primeiro
  const slideLeft = (i) => slides[i].offsetLeft - slides[0].offsetLeft;
  const currentIndex = () => {
    const x = trackEl.scrollLeft;
    let best = 0;
    let bestDist = Infinity;
    slides.forEach((_, i) => {
      const d = Math.abs(slideLeft(i) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };
  const goTo = (i) => {
    const idx = (i + slides.length) % slides.length;
    trackEl.scrollTo({ left: slideLeft(idx), behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  // --- Dots -----------------------------------------------------------------
  let dotEls = [];
  const dotsWrap = dots ? root?.querySelector('[data-dots]') : null;
  if (dotsWrap) {
    dotsWrap.innerHTML = slides
      .map(
        (_, i) =>
          `<button type="button" class="dot" data-dot="${i}" aria-label="Ir para o slide ${i + 1}"></button>`
      )
      .join('');
    dotEls = Array.from(dotsWrap.querySelectorAll('[data-dot]'));
    dotEls.forEach((d, i) =>
      d.addEventListener('click', () => {
        goTo(i);
        restart();
      })
    );
  }

  const syncUI = () => {
    const cur = currentIndex();
    dotEls.forEach((d, i) =>
      d.setAttribute('aria-current', i === cur ? 'true' : 'false')
    );
  };

  // --- Autoplay -------------------------------------------------------------
  let timer = null;
  const canAuto = autoplay && !reduceMotion && slides.length > 1;
  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  const start = () => {
    if (canAuto && !timer && !document.hidden) {
      timer = setInterval(() => goTo(currentIndex() + 1), interval);
    }
  };
  const restart = () => {
    stop();
    start();
  };

  if (canAuto) {
    // Pausa em hover, foco e toque; retoma depois
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);
    root.addEventListener('pointerdown', stop);
    root.addEventListener('pointerup', restart);
    root.addEventListener('touchstart', stop, { passive: true });
    root.addEventListener('touchend', restart, { passive: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }

  // --- Botões prev/next (opcionais) -----------------------------------------
  root?.querySelector('[data-carousel-prev]')?.addEventListener('click', () => {
    goTo(currentIndex() - 1);
    restart();
  });
  root?.querySelector('[data-carousel-next]')?.addEventListener('click', () => {
    goTo(currentIndex() + 1);
    restart();
  });

  // --- Teclado --------------------------------------------------------------
  trackEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(currentIndex() + 1);
      restart();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(currentIndex() - 1);
      restart();
    }
  });

  // --- Sincroniza dots ao rolar (throttle com rAF) --------------------------
  let ticking = false;
  trackEl.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          syncUI();
          ticking = false;
        });
      }
    },
    { passive: true }
  );

  syncUI();
  start();
}

// =============================================================================
// PÁGINA DE CATÁLOGO (loja.html) — grid + filtro por categoria.
// DOM: [data-catalog-grid] pro grid; [data-filter="all|<categoria>"] nos botões.
// =============================================================================
function cardProdutoHTML(p) {
  const acao = p.variantes
    ? `<a href="/pages/produto.html?slug=${p.slug}" class="btn-primary flex-1">escolher</a>`
    : `<button type="button" data-add="${p.id}" class="btn-primary flex-1">adicionar</button>`;
  return `
    <article class="flex flex-col overflow-hidden rounded-2xl bg-branco/60 ring-1 ring-cafe/10" data-produto data-categoria="${p.categoria}">
      <a href="/pages/produto.html?slug=${p.slug}" class="block" aria-label="${p.nome}">
        <div class="${p.imagemPlaceholder} aspect-square w-full"></div>
      </a>
      <div class="flex flex-1 flex-col p-4">
        <p class="text-xs uppercase tracking-wide text-cafe/50">${CATEGORIAS[p.categoria]}</p>
        <h3 class="mt-1 font-titulo text-lg leading-tight">
          <a href="/pages/produto.html?slug=${p.slug}" class="hover:text-terracota">${p.nome}</a>
        </h3>
        <p class="mt-2 font-medium text-cafe">${formatBRL(p.preco_centavos)}</p>
        <div class="mt-4 flex gap-2">
          <a href="/pages/produto.html?slug=${p.slug}" class="btn-ghost flex-1">ver</a>
          ${acao}
        </div>
      </div>
    </article>`;
}

function initCatalogPage() {
  const grid = document.querySelector('[data-catalog-grid]');
  if (!grid) return;

  grid.innerHTML = PRODUTOS.map(cardProdutoHTML).join('');

  const vazio = document.querySelector('[data-catalog-empty]');
  const botoes = Array.from(document.querySelectorAll('[data-filter]'));

  const aplicarFiltro = (cat) => {
    let visiveis = 0;
    grid.querySelectorAll('[data-produto]').forEach((card) => {
      const mostra = cat === 'all' || card.getAttribute('data-categoria') === cat;
      card.classList.toggle('hidden', !mostra);
      if (mostra) visiveis += 1;
    });
    if (vazio) vazio.classList.toggle('hidden', visiveis > 0);
    botoes.forEach((b) => {
      const ativo = b.getAttribute('data-filter') === cat;
      b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
      b.classList.toggle('bg-terracota', ativo);
      b.classList.toggle('text-bege', ativo);
      b.classList.toggle('border-terracota', ativo);
    });
  };

  botoes.forEach((b) =>
    b.addEventListener('click', () => aplicarFiltro(b.getAttribute('data-filter')))
  );

  // "adicionar" direto (produtos sem variante) abre o drawer
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    Cart.addItem(btn.getAttribute('data-add'), null, 1);
    openDrawer();
  });

  aplicarFiltro('all');
  renderIcons();
}

// =============================================================================
// PÁGINA DE PRODUTO (produto.html) — lê ?slug=, renderiza o detalhe.
// DOM: [data-product-root] recebe o markup (ou o estado vazio gentil).
// =============================================================================
function initProductPage() {
  const rootEl = document.querySelector('[data-product-root]');
  if (!rootEl) return;

  const slug = new URLSearchParams(window.location.search).get('slug');
  const p = slug ? getProdutoPorSlug(slug) : null;

  if (!p) {
    rootEl.innerHTML = `
      <div class="py-20 text-center">
        <p class="decor text-3xl">a gente não achou esse produto</p>
        <p class="mx-auto mt-2 max-w-sm text-cafe/60">pode ser que ele tenha saído da vitrine. dá uma olhada no que tem por lá?</p>
        <a href="/pages/loja.html" class="btn-primary mt-6">voltar pra loja</a>
      </div>`;
    renderIcons();
    return;
  }

  document.title = `${p.nome} — Casa Coffee Colab`;

  let variante = p.variantes ? p.variantes.opcoes[0] : null;
  let qtd = 1;

  const variantesHTML = p.variantes
    ? `
      <div class="mt-6">
        <span class="text-sm font-medium text-cafe">${p.variantes.rotulo}</span>
        <div class="mt-2 flex flex-wrap gap-2" data-variantes>
          ${p.variantes.opcoes
            .map(
              (o, i) =>
                `<button type="button" data-variante="${o}" aria-pressed="${i === 0}" class="rounded-full border px-4 py-2 text-sm transition-colors ${
                  i === 0 ? 'border-terracota bg-terracota/10 text-terracota' : 'border-cafe/20 text-cafe hover:border-terracota'
                }">${o}</button>`
            )
            .join('')}
        </div>
      </div>`
    : '';

  rootEl.innerHTML = `
    <div class="grid gap-8 lg:grid-cols-2">
      <div class="${p.imagemPlaceholder} aspect-square w-full rounded-2xl"></div>
      <div>
        <a href="/pages/loja.html" class="inline-flex items-center gap-1 text-sm text-cafe/60 hover:text-terracota">
          <i data-lucide="chevron-left" class="h-4 w-4"></i> voltar pra loja
        </a>
        <p class="mt-4 text-xs uppercase tracking-wide text-cafe/50">${CATEGORIAS[p.categoria]}</p>
        <h1 class="mt-1 font-titulo text-3xl sm:text-4xl">${p.nome}</h1>
        <p class="mt-3 font-titulo text-2xl text-terracota">${formatBRL(p.preco_centavos)}</p>
        <p class="mt-4 max-w-prose text-cafe/80">${p.descricao}</p>
        ${variantesHTML}
        <div class="mt-6">
          <span class="text-sm font-medium text-cafe">Quantidade</span>
          <div class="mt-2 flex flex-wrap items-center gap-4">
            <div class="inline-flex items-center rounded-full border border-cafe/20">
              <button type="button" data-qty-dec aria-label="Diminuir quantidade" class="grid h-10 w-10 place-items-center text-cafe hover:text-terracota">
                <i data-lucide="minus" class="h-4 w-4"></i>
              </button>
              <span class="w-10 text-center" data-qty>1</span>
              <button type="button" data-qty-inc aria-label="Aumentar quantidade" class="grid h-10 w-10 place-items-center text-cafe hover:text-terracota">
                <i data-lucide="plus" class="h-4 w-4"></i>
              </button>
            </div>
            <button type="button" data-add-detail class="btn-primary">adicionar ao carrinho</button>
          </div>
        </div>
        <p class="mt-6 text-xs text-cafe/50">leva junto, no teu ritmo. o frete e o pagamento a gente acerta no checkout (em breve).</p>
      </div>
    </div>`;

  // Variante
  rootEl.querySelectorAll('[data-variante]').forEach((btn) =>
    btn.addEventListener('click', () => {
      variante = btn.getAttribute('data-variante');
      rootEl.querySelectorAll('[data-variante]').forEach((b) => {
        const ativo = b === btn;
        b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
        b.classList.toggle('border-terracota', ativo);
        b.classList.toggle('bg-terracota/10', ativo);
        b.classList.toggle('text-terracota', ativo);
        b.classList.toggle('border-cafe/20', !ativo);
      });
    })
  );

  // Quantidade
  const qtyEl = rootEl.querySelector('[data-qty]');
  const setQtd = (v) => {
    qtd = Math.max(1, v);
    if (qtyEl) qtyEl.textContent = String(qtd);
  };
  rootEl.querySelector('[data-qty-dec]')?.addEventListener('click', () => setQtd(qtd - 1));
  rootEl.querySelector('[data-qty-inc]')?.addEventListener('click', () => setQtd(qtd + 1));

  // Adicionar → abre o drawer
  rootEl.querySelector('[data-add-detail]')?.addEventListener('click', () => {
    Cart.addItem(p.id, variante, qtd);
    openDrawer();
  });

  renderIcons();
}

// =============================================================================
// PÁGINA DE PLANOS (planos.html) — botões "assinar" são placeholder.
// O checkout (Stripe) vem na Fase 2; por ora só revela o aviso gentil.
// =============================================================================
function initPlanosPage() {
  const botoes = document.querySelectorAll('[data-assinar]');
  if (botoes.length === 0) return;
  const nota = document.querySelector('[data-assinar-note]');

  const avisar = (msg) => {
    if (!nota) return;
    nota.textContent = msg; // textContent (nunca innerHTML) — sem risco de XSS
    nota.classList.remove('hidden');
    nota.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  botoes.forEach((btn) =>
    btn.addEventListener('click', async () => {
      const tier = btn.dataset.tier;
      if (!tier) return;

      // Config pendente → degrada com aviso gentil, sem quebrar.
      if (!supabase) return avisar('a assinatura ainda não tá ligada por aqui (config pendente). 💛');

      // Deslogado → manda pro login guardando o destino (volta pros planos).
      const session = await getSession();
      if (!session) {
        const destino = encodeURIComponent('/pages/planos.html');
        window.location.href = `/pages/login.html?redirect=${destino}`;
        return;
      }

      const textoBtn = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'te levando pro pagamento…';
      try {
        // O preço vem do BANCO na Edge Function — o client só manda o tier_slug.
        // functions.invoke já envia o JWT da sessão no Authorization (a function valida).
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
          body: { tier_slug: tier },
        });
        if (error || !data?.url) {
          avisar('não deu pra abrir o pagamento agora. tenta de novo daqui a pouco? 💛');
          return;
        }
        window.location.href = data.url; // Checkout hospedado do Stripe
      } catch {
        avisar('a gente não conseguiu falar com o servidor agora. confere tua conexão?');
      } finally {
        btn.disabled = false;
        btn.textContent = textoBtn;
      }
    })
  );
}

// =============================================================================
// AUTH — UI do header, guard de rota e páginas (cadastro/login/perfil).
// =============================================================================

// Sai da conta e volta pra home.
async function doSignOut() {
  await signOut();
  window.location.href = '/pages/home.html';
}

// Preenche os slots de auth do header conforme a sessão (deslogado ↔ logado).
function updateAuthUI(session) {
  const nome = escapeHtml(nomeDeExibicao(session)); // sempre escapado (anti-XSS)

  const slot = document.querySelector('[data-auth-slot]');
  if (slot) {
    slot.innerHTML = session
      ? `<a href="/pages/conta/perfil.html" class="inline-flex items-center gap-2 text-sm font-medium text-cafe hover:text-terracota">
           <span class="grid h-8 w-8 place-items-center rounded-full bg-terracota/10 text-terracota"><i data-lucide="user" class="h-4 w-4"></i></span>
           <span class="max-w-[9rem] truncate">${nome}</span>
         </a>
         <button type="button" data-signout class="ml-3 inline-flex items-center gap-1 text-sm text-cafe/70 hover:text-terracota">
           <i data-lucide="log-out" class="h-4 w-4"></i>sair
         </button>`
      : `<a href="/pages/login.html" class="btn-ghost">entrar</a>`;
  }

  const slotM = document.querySelector('[data-auth-slot-mobile]');
  if (slotM) {
    slotM.innerHTML = session
      ? `<a href="/pages/conta/perfil.html" class="flex items-center gap-2 py-2 text-lg text-cafe" data-menu-link>
           <i data-lucide="user" class="h-5 w-5"></i>${nome}
         </a>
         <button type="button" data-signout class="mt-2 inline-flex items-center gap-2 text-cafe/70 hover:text-terracota">
           <i data-lucide="log-out" class="h-5 w-5"></i>sair da conta
         </button>`
      : `<a href="/pages/login.html" class="btn-ghost w-full" data-menu-link>entrar</a>`;
  }

  // Liga o "sair" só nos botões do header (o perfil liga o seu próprio).
  [slot, slotM].forEach((s) => s?.querySelector('[data-signout]')?.addEventListener('click', doSignOut));
  renderIcons();
}

// Header reflete o estado de auth e reage a login/logout (inclusive entre abas).
async function initAuth() {
  updateAuthUI(await getSession());
  if (supabase) {
    supabase.auth.onAuthStateChange((_evento, session) => updateAuthUI(session));
  }
}

// Guard: exige sessão. Sem sessão → manda pro login guardando o destino.
// NUNCA confia em role do client — quem precisar de papel lê do profiles (banco).
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    const destino = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/pages/login.html?redirect=${destino}`);
    return null;
  }
  return session;
}

// Só aceita redirect interno (começa com "/" e não "//") — anti open-redirect.
function sanitizeRedirect(valor) {
  if (valor && /^\/(?!\/)/.test(valor)) return valor;
  return null;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// --- Cadastro ------------------------------------------------------------------
function initCadastroPage() {
  const form = document.querySelector('[data-cadastro-form]');
  if (!form) return;

  const erroEl = form.querySelector('[data-form-erro]');
  const btn = form.querySelector('[type="submit"]');
  const mostrarErro = (msg) => {
    if (!erroEl) return;
    erroEl.textContent = msg;
    erroEl.classList.remove('hidden');
  };
  const limparErro = () => {
    if (!erroEl) return;
    erroEl.textContent = '';
    erroEl.classList.add('hidden');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparErro();

    const nome = form.nome.value.trim();
    const telefone = form.telefone.value.trim();
    const email = form.email.value.trim();
    const senha = form.senha.value;
    const confirma = form.confirma.value;

    if (!nome) return mostrarErro('conta pra gente teu nome? 💛');
    if (!EMAIL_RE.test(email)) return mostrarErro('esse e-mail parece incompleto. dá uma conferida?');
    if (senha.length < 8) return mostrarErro('a senha precisa de pelo menos 8 caracteres.');
    if (senha !== confirma) return mostrarErro('as senhas não são iguais. confere pra gente?');
    if (!supabase) return mostrarErro('o cadastro ainda não tá ligado por aqui (config pendente).');

    const textoBtn = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'criando tua conta…';
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          // nome e telefone vão pro raw_user_meta_data → a trigger handle_new_user popula o profiles.
          data: { full_name: nome, telefone },
          // link do e-mail de confirmação volta pra uma página do próprio site (env-driven).
          emailRedirectTo: `${siteBase()}/pages/auth-confirmado.html`,
        },
      });
      if (error) return mostrarErro(mensagemDeErroAuth(error));

      if (data.session) {
        // "Confirm email" desligado → já entrou. Vai pro perfil.
        window.location.href = '/pages/conta/perfil.html';
        return;
      }

      // "Confirm email" ligado → estado "confirme seu e-mail".
      form.classList.add('hidden');
      const sucesso = document.querySelector('[data-cadastro-sucesso]');
      if (sucesso) {
        const alvo = sucesso.querySelector('[data-email-alvo]');
        if (alvo) alvo.textContent = email; // textContent (não innerHTML) — sem risco de XSS
        sucesso.classList.remove('hidden');
      }
    } catch (err) {
      mostrarErro(mensagemDeErroAuth(err));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = textoBtn;
      }
    }
  });
}

// --- Login (+ esqueci a senha) -------------------------------------------------
function initLoginPage() {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;

  const erroEl = form.querySelector('[data-form-erro]');
  const btn = form.querySelector('[type="submit"]');
  const resetMsg = form.querySelector('[data-reset-msg]');
  const redirect = sanitizeRedirect(new URLSearchParams(window.location.search).get('redirect'));

  const mostrarErro = (msg) => {
    if (!erroEl) return;
    erroEl.textContent = msg;
    erroEl.classList.remove('hidden');
  };
  const limparErro = () => {
    if (!erroEl) return;
    erroEl.textContent = '';
    erroEl.classList.add('hidden');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparErro();
    if (resetMsg) resetMsg.classList.add('hidden');

    const email = form.email.value.trim();
    const senha = form.senha.value;
    if (!EMAIL_RE.test(email)) return mostrarErro('esse e-mail parece incompleto. dá uma conferida?');
    if (!senha) return mostrarErro('falta a senha. 💛');
    if (!supabase) return mostrarErro('o login ainda não tá ligado por aqui (config pendente).');

    const textoBtn = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'entrando…';
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) return mostrarErro(mensagemDeErroAuth(error));
      window.location.href = redirect || '/pages/conta/perfil.html';
    } catch (err) {
      mostrarErro(mensagemDeErroAuth(err));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = textoBtn;
      }
    }
  });

  // Esqueci a senha — envia o link de redefinição (Supabase resetPasswordForEmail).
  form.querySelector('[data-reset]')?.addEventListener('click', async () => {
    limparErro();
    const email = form.email.value.trim();
    if (!EMAIL_RE.test(email))
      return mostrarErro('preenche teu e-mail ali em cima que a gente te manda o link. 💛');
    if (!supabase) return mostrarErro('o reset de senha ainda não tá ligado por aqui (config pendente).');
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteBase()}/pages/login.html`,
      });
    } catch {
      /* não revela se o e-mail existe — mensagem é sempre a mesma */
    }
    if (resetMsg) {
      resetMsg.textContent = 'se esse e-mail tiver conta, o link pra criar uma senha nova já tá a caminho. 💛';
      resetMsg.classList.remove('hidden');
    }
  });
}

// --- Perfil (área logada) ------------------------------------------------------
async function initPerfilPage() {
  const root = document.querySelector('[data-perfil-root]');
  if (!root) return;

  const session = await requireAuth();
  if (!session) return; // já redirecionou pro login

  const email = escapeHtml(session.user.email || '');
  const profile = await getProfile();
  const nome = escapeHtml(profile?.full_name || nomeDeExibicao(session));
  const telefone = escapeHtml(profile?.telefone || '');
  const pontos = Number(profile?.points_balance || 0).toLocaleString('pt-BR');

  // Nome do plano (tiers é leitura pública). Sem plano ainda → texto gentil.
  let plano = 'ainda sem plano';
  if (profile?.tier_slug && supabase) {
    const { data: t } = await supabase.from('tiers').select('nome').eq('slug', profile.tier_slug).single();
    plano = escapeHtml(t?.nome || profile.tier_slug);
  }

  root.innerHTML = `
    <div class="mx-auto max-w-2xl">
      <p class="decor text-2xl sm:text-3xl">que bom te ver</p>
      <h1 class="mt-1 font-titulo text-3xl sm:text-4xl">oi, ${nome}</h1>

      <dl class="mt-8 grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl bg-branco/60 p-4 ring-1 ring-cafe/10">
          <dt class="text-xs uppercase tracking-wide text-cafe/50">teus pontos</dt>
          <dd class="mt-1 font-titulo text-2xl text-terracota">${pontos}</dd>
        </div>
        <div class="rounded-2xl bg-branco/60 p-4 ring-1 ring-cafe/10">
          <dt class="text-xs uppercase tracking-wide text-cafe/50">teu plano</dt>
          <dd class="mt-1 font-titulo text-lg">${plano}</dd>
        </div>
        <div class="rounded-2xl bg-branco/60 p-4 ring-1 ring-cafe/10">
          <dt class="text-xs uppercase tracking-wide text-cafe/50">e-mail</dt>
          <dd class="mt-1 truncate text-sm text-cafe" title="${email}">${email}</dd>
        </div>
      </dl>

      <form class="mt-10" data-perfil-form novalidate>
        <h2 class="font-titulo text-xl">teus dados</h2>
        <p class="mt-1 text-sm text-cafe/60">atualiza quando quiser — é só teu.</p>

        <div class="mt-5">
          <label for="perfil-nome" class="block text-sm font-medium text-cafe">nome</label>
          <input id="perfil-nome" name="nome" type="text" value="${nome}" autocomplete="name"
            class="mt-1 w-full rounded-xl border border-cafe/20 bg-branco/70 px-4 py-2.5 text-cafe focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota" />
        </div>

        <div class="mt-4">
          <label for="perfil-telefone" class="block text-sm font-medium text-cafe">telefone</label>
          <input id="perfil-telefone" name="telefone" type="tel" value="${telefone}" autocomplete="tel"
            class="mt-1 w-full rounded-xl border border-cafe/20 bg-branco/70 px-4 py-2.5 text-cafe focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota" />
        </div>

        <p class="mt-3 hidden text-sm" data-perfil-msg aria-live="polite"></p>
        <button type="submit" class="btn-primary mt-5">salvar</button>
      </form>

      <div class="mt-10 border-t border-cafe/10 pt-6">
        <button type="button" data-signout class="btn-ghost">
          <i data-lucide="log-out" class="h-4 w-4"></i>sair da conta
        </button>
      </div>
    </div>`;

  renderIcons();

  // Editar nome/telefone — update na PRÓPRIA linha (RLS garante id = auth.uid()).
  const perfilForm = root.querySelector('[data-perfil-form]');
  const msg = root.querySelector('[data-perfil-msg]');
  const salvarBtn = perfilForm?.querySelector('[type="submit"]');
  perfilForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (msg) msg.classList.add('hidden');
    const novoNome = perfilForm.nome.value.trim();
    const novoTel = perfilForm.telefone.value.trim();
    if (!novoNome) {
      if (msg) {
        msg.textContent = 'conta pra gente teu nome? 💛';
        msg.className = 'mt-3 text-sm text-terracota';
        msg.classList.remove('hidden');
      }
      return;
    }
    const textoBtn = salvarBtn?.textContent;
    if (salvarBtn) {
      salvarBtn.disabled = true;
      salvarBtn.textContent = 'salvando…';
    }
    try {
      // Fonte da verdade dos dados: profiles (RLS: só a própria linha).
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: novoNome, telefone: novoTel })
        .eq('id', session.user.id);
      if (!error) {
        // Espelha no metadata do auth (é o que o header usa pra mostrar o nome).
        await supabase.auth.updateUser({ data: { full_name: novoNome, telefone: novoTel } });
      }
      if (msg) {
        if (error) {
          msg.textContent = 'não deu pra salvar agora. tenta de novo daqui a pouco?';
          msg.className = 'mt-3 text-sm text-terracota';
        } else {
          msg.textContent = 'prontinho, teus dados foram salvos. 💛';
          msg.className = 'mt-3 text-sm text-verde';
          updateAuthUI(await getSession()); // reflete o nome novo no header
        }
        msg.classList.remove('hidden');
      }
    } finally {
      if (salvarBtn) {
        salvarBtn.disabled = false;
        salvarBtn.textContent = textoBtn;
      }
    }
  });

  root.querySelector('[data-signout]')?.addEventListener('click', doSignOut);
}

// --- Confirmação de e-mail (retorno do link) -----------------------------------
// O supabase-js detecta a sessão na URL (detectSessionInUrl é padrão). Se logou,
// oferece ir pra conta; se não (link velho/expirado), manda pro login com carinho.
async function initAuthConfirmadoPage() {
  const root = document.querySelector('[data-auth-confirmado-root]');
  if (!root) return;

  const render = (session) => {
    root.innerHTML = session
      ? `<span class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-verde/10 text-verde">
           <i data-lucide="heart" class="h-8 w-8"></i>
         </span>
         <h1 class="mt-5 font-titulo text-3xl sm:text-4xl">teu e-mail tá confirmado</h1>
         <p class="mt-3 text-cafe/70">bem-vindo ao Casa. 💛 tua conta já tá pronta — chega mais.</p>
         <a href="/pages/conta/perfil.html" class="btn-primary mt-7">ir pra minha conta</a>`
      : `<span class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-terracota/10 text-terracota">
           <i data-lucide="mail" class="h-8 w-8"></i>
         </span>
         <h1 class="mt-5 font-titulo text-3xl sm:text-4xl">quase lá</h1>
         <p class="mt-3 text-cafe/70">esse link pode já ter sido usado ou expirado. entra com teu e-mail e senha que a gente te recebe.</p>
         <a href="/pages/login.html" class="btn-primary mt-7">ir pro login</a>`;
    renderIcons();
  };

  // Primeira leitura + fallback: a sessão pode chegar logo após o parse da URL.
  const session = await getSession();
  render(session);
  if (supabase && !session) {
    supabase.auth.onAuthStateChange((_evento, s) => {
      if (s) render(s);
    });
  }
}

// Configura os carrosséis do tipo "cards" (home e colab) + o hero (home).
function initCarousels() {
  const hero = document.querySelector('[data-carousel="hero"] [data-carousel-track]');
  if (hero) setupCarousel(hero, { dots: true, autoplay: true, interval: 5500 });

  document
    .querySelectorAll('[data-carousel="cards"] [data-carousel-track]')
    .forEach((track) => setupCarousel(track, { dots: false, autoplay: false }));
}

// --- Bootstrap -----------------------------------------------------------------
export function initSite() {
  renderHeader();
  renderFooter();
  initAuth(); // header reflete a sessão + reage a login/logout (todas as páginas)
  initCart(); // drawer + badge (todas as páginas)
  initCatalogPage(); // só age se houver [data-catalog-grid]
  initProductPage(); // só age se houver [data-product-root]
  initPlanosPage(); // só age se houver [data-assinar]
  initCadastroPage(); // só age se houver [data-cadastro-form]
  initLoginPage(); // só age se houver [data-login-form]
  initPerfilPage(); // só age se houver [data-perfil-root] (protege a rota)
  initAuthConfirmadoPage(); // só age se houver [data-auth-confirmado-root]
  initCarousels(); // só age se houver [data-carousel]
  renderIcons(); // ícones do header/footer + conteúdo estático restante
}

// Auto-inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSite);
} else {
  initSite();
}

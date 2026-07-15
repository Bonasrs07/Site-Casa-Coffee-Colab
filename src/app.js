// =============================================================================
// Casa Coffee Colab — app.js
// Camada de interface (JS vanilla). Um arquivo por camada — ver CLAUDE.md.
//
// Header, footer e menu são funções que injetam HTML nos placeholders da página:
//   <div id="site-header"></div>  /  <div id="site-footer"></div>
// Cada página .html é uma URL própria; ela chama initSite() no fim.
// =============================================================================

import './styles.css';

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

// Navegação principal. `href` aponta pra cada página (uma URL cada).
const NAV = [
  { rotulo: 'Home', href: '/home.html' },
  { rotulo: 'O Casa', href: '/o-casa.html' },
  { rotulo: 'Cardápio', href: '/cardapio.html' },
  { rotulo: 'Loja', href: '/loja.html' },
  { rotulo: 'Planos', href: '/planos.html' },
  { rotulo: 'Colab', href: '/colab.html' },
];

// --- Header --------------------------------------------------------------------
function renderHeader() {
  const slot = document.getElementById('site-header');
  if (!slot) return;

  const linksDesktop = NAV.map(
    (item) =>
      `<a href="${item.href}" class="text-cafe/80 hover:text-terracota transition-colors">${item.rotulo}</a>`
  ).join('');

  const linksMobile = NAV.map(
    (item) =>
      `<a href="${item.href}" class="block py-3 text-lg text-cafe hover:text-terracota transition-colors" data-menu-link>${item.rotulo}</a>`
  ).join('');

  slot.innerHTML = `
    <header id="topo" class="sticky top-0 z-50 transition-colors duration-300" data-site-header>
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 3xl:max-w-[1600px]">
        <!-- Logo -->
        <a href="/home.html" class="flex items-center gap-2 shrink-0">
          <span class="font-titulo text-lg font-semibold text-terracota sm:text-xl">Casa Coffee Colab</span>
        </a>

        <!-- Nav desktop -->
        <nav class="hidden items-center gap-6 text-sm font-medium lg:flex" aria-label="Navegação principal">
          ${linksDesktop}
        </nav>

        <!-- CTA desktop -->
        <a href="#" class="btn-primary hidden lg:inline-flex">${MARCA.cta}</a>

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
          <a href="#" class="btn-primary mt-4 w-full" data-menu-link>${MARCA.cta}</a>
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

// --- Bootstrap -----------------------------------------------------------------
export function initSite() {
  renderHeader();
  renderFooter();
}

// Auto-inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSite);
} else {
  initSite();
}

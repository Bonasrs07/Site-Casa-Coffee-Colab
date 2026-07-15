# Casa Coffee Colab — Contexto do Projeto

Site do **Casa Coffee Colab**, um café-casa de encontros em Novo Hamburgo/RS.
"O Casa é café, afeto e comida boa."

Construído em fases. Esta é a fundação visual — sem backend ainda.

---

## Stack

- **Vite** (vanilla, multi-página) — cada página é uma URL/`.html` própria.
- **Tailwind CSS** (CLI/PostCSS) — não usar CDN.
- **JS vanilla** — sem framework.
- **Fontes** via `@fontsource` (bundled, sem CDN externo).

Fases seguintes (ainda **não** implementadas):
- **Supabase** — auth, banco, RLS, edge functions.
- **Stripe** — pagamentos.
- **Deploy** na **Vercel**.

---

## Convenção de código

Código **consolidado**: UM arquivo grande por camada, pra facilitar busca durante o desenvolvimento. Não fragmentar em muitos arquivos pequenos.

- `src/app.js` — toda a lógica/JS da camada de interface.
- `src/styles.css` — entrada Tailwind + estilos base.
- `src/schema.sql` — (futuro) todo o schema do banco.

**Header, footer e menu são funções dentro do `app.js`** que injetam HTML nos placeholders da página (`<div id="site-header"></div>` / `<div id="site-footer"></div>`).

**Páginas `.html` continuam separadas** — cada uma é uma URL. Ficam em `src/pages/` (exceto a home, que é a entrada principal do Vite).

---

## Paleta (tokens Tailwind)

| Token       | Hex       | Uso                          |
|-------------|-----------|------------------------------|
| `terracota` | `#8c3a2a` | cor primária / acento quente |
| `verde`     | `#305429` | secundária / natureza        |
| `cafe`      | `#5b3c34` | texto escuro / café          |
| `caramelo`  | `#a56a3a` | destaques dourados           |
| `bege`      | `#ead8c1` | fundos claros / papel        |
| `preto`     | `#000000` | —                            |
| `branco`    | `#ffffff` | —                            |

---

## Tipografia

- **Sora** → `font-sora` — texto/UI, corpo.
- **Títulos** → `font-titulo` — placeholder **Fraunces**.
- **Decorativa/manuscrita** → `font-decor` — placeholder **Caveat**.

> **TODO (fontes reais):** as fontes oficiais da marca são **Rexton** (títulos/UI) e **Mayonice** (decorativa) — ambas **pagas**. Enquanto não temos as licenças, usamos **Fraunces** (títulos) e **Caveat** (decorativa) como placeholder. Quando as fontes reais chegarem, trocar em `@fontsource`/`styles.css` e nos tokens `fontFamily` do `tailwind.config.js`. Sora permanece.

---

## Tom de voz da marca

**SEGUIR SEMPRE** — inclusive em microcopy, botões, mensagens de erro e labels.

- Acolhedor, autoral, poético contido, urbano-afetivo, humilde.
- Tratamento **"tu" / "a gente"**.
- CTAs gentis: *"passa aqui?"*, *"fica um pouco"*, *"entra, senta, fica um pouco"*.

**EVITAR sempre:**
- Palavras: *gourmet, luxo, premium, exclusivo, hype, trend*.
- Imperativos agressivos: *"aproveita já!"*, *"corre!"*.
- Qualquer gamificação com cara de cassino (roleta, "gire pra ganhar", contadores de urgência falsos).

---

## Contato oficial (header/footer)

- **Endereço:** R. Victor Hugo Kunz, 411 — Hamburgo Velho, Novo Hamburgo/RS
- **E-mail:** casacoffeecolab@gmail.com
- **Telefone:** (51) 99360-5262
- **Horário:** Seg a sáb 8h–19h · dom 15h–19h

Redes (placeholders por enquanto): Instagram, Facebook, Spotify.

---

## Imagens / fotos reais (TODO)

Ainda **não temos fotos**. Todas as imagens são **placeholders de gradiente** com as
cores da marca, via utilitários no `styles.css`:

- `.photo-warm` — gradiente terracota→caramelo→café (quente).
- `.photo-green` — gradiente verde→café.
- `.photo-bege` — gradiente bege→caramelo (claro).

> **TODO (trocar por fotos reais):** substituir os `div.photo-*` por `<img>`/`background-image`
> reais quando as fotos chegarem. Onde entram fotos hoje (na `home.html`):
> - **Hero** — 3 slides (fundo full-bleed de cada `article.carousel-slide`).
> - **Feito no Casa** — 4 cards de cardápio (topo de cada card, `aspect-[4/3]`).
> - **Gente do Casa** — 3 cards de colab (faixa lateral de cada card).
> - **A loja do Casa** — 4 cards de produto (`aspect-square`).
> - **Playlists** — o card placeholder vira o embed real do Spotify (`<iframe>`, já
>   comentado no HTML).
> As classes `.photo-*` podem permanecer como fallback/skeleton.

---

## Ícones

- **Lucide** via módulo `lucide` (sem CDN). Uso: `<i data-lucide="nome"></i>` no HTML;
  `renderIcons()` no `app.js` chama `createIcons()` e substitui por SVG **após** injetar markup.
- Importar só os ícones usados (tree-shaking) no topo do `app.js` e registrar em `LUCIDE_ICONS`.

---

## Carrossel

- Função única `setupCarousel(trackEl, { dots, autoplay, interval })` no `app.js` — serve os 3 tracks.
- Base em **scroll-snap** horizontal (`.carousel-track`), navegável por swipe/scroll, teclado (setas) e dots.
- **Autoplay** (só no hero) respeita `prefers-reduced-motion` e pausa em hover/foco/toque.
- Contrato de DOM: `[data-carousel]` › `[data-carousel-track]` (+ opcionais `[data-dots]`,
  `[data-carousel-prev]`, `[data-carousel-next]`).

---

## Responsividade

- **Mobile-first**, funcionando desde **~320px** (Galaxy Pocket) até **ultrawide (2560px+)**.
- Breakpoints extras no Tailwind: `xs` 375, `3xl` 1920, `4xl` 2560 (mantendo `sm/md/lg/xl/2xl` padrão).
- Sempre respeitar **`prefers-reduced-motion`**.

---

## Estrutura de pastas

```
/
├── index.html            # home (entrada principal do Vite)
├── src/
│   ├── app.js            # header/footer/menu + lógica de UI
│   ├── styles.css        # entrada Tailwind + base
│   ├── pages/            # demais páginas .html (uma por URL)
│   └── assets/           # imagens, ícones, etc.
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── package.json
```

---

## Comandos

- `npm run dev` — servidor de desenvolvimento (Vite).
- `npm run build` — build de produção.
- `npm run preview` — pré-visualiza o build.

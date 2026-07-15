import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Raiz do Vite = src/. Assim as páginas em src/pages/ alcançam
// src/app.js e src/styles.css (compartilhados por todas). Ver CLAUDE.md.
const root = resolve(__dirname, 'src');

// Multi-página: a home é a entrada principal. Novas páginas .html em
// src/pages/ entram aqui em `input` (uma URL cada).
export default defineConfig({
  root,
  // .env fica na RAIZ do projeto, mas o root do Vite é src/ — sem isto o Vite
  // procuraria .env dentro de src/ e as VITE_* nunca seriam carregadas.
  envDir: __dirname,
  publicDir: resolve(__dirname, 'src/assets'),
  server: {
    open: '/pages/home.html',
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(root, 'pages/home.html'),
        oCasa: resolve(root, 'pages/o-casa.html'),
        cardapio: resolve(root, 'pages/cardapio.html'),
        loja: resolve(root, 'pages/loja.html'),
        produto: resolve(root, 'pages/produto.html'),
        planos: resolve(root, 'pages/planos.html'),
        colab: resolve(root, 'pages/colab.html'),
        cadastro: resolve(root, 'pages/cadastro.html'),
        login: resolve(root, 'pages/login.html'),
        authConfirmado: resolve(root, 'pages/auth-confirmado.html'),
        perfil: resolve(root, 'pages/conta/perfil.html'),
      },
    },
  },
});

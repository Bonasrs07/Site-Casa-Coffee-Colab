import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Raiz do Vite = src/. Assim as páginas em src/pages/ alcançam
// src/app.js e src/styles.css (compartilhados por todas). Ver CLAUDE.md.
const root = resolve(__dirname, 'src');

// Multi-página: a home é a entrada principal. Novas páginas .html em
// src/pages/ entram aqui em `input` (uma URL cada).
export default defineConfig({
  root,
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
        loja: resolve(root, 'pages/loja.html'),
        produto: resolve(root, 'pages/produto.html'),
      },
    },
  },
});

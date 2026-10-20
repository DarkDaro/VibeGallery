import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron/simple';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** CSP подставляется в html по режиму: dev длист зелёные HMR, prod — строгий. */
const cspPlugin = (): Plugin => ({
  name: 'vibe:csp',
  transformIndexHtml: (html, ctx) => {
    const csp = ctx.server
      ? "default-src 'self'; script-src 'self' http://localhost:*; script-src-elem 'self' http://localhost:*; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' media: data: blob:; font-src 'self'; connect-src 'self' ws://localhost:* http://localhost:*; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' media: data: blob:; media-src 'self' media: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'";
    return html.replace('<!--%CSP%-->', `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
  },
});

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        settings: resolve(__dirname, 'src/settings.html'),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rolldownOptions: {
              external: ['better-sqlite3', 'electron'],
            },
          },
        },
      },
      preload: {
        input: resolve(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            rolldownOptions: {
              external: ['electron'],
            },
          },
        },
      },
    }),
    cspPlugin(),
  ],
});

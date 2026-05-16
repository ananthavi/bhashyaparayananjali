import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// When deploying to GitHub Pages on a project repo, the site is served
// from `username.github.io/<repo>/`, so all asset URLs must be prefixed
// with that path. Override at build time via:
//   PUBLIC_BASE=/bhashyaparayananjali/ npm run build  (GitHub Pages, repo "bhashyaparayananjali")
//   PUBLIC_BASE=/    npm run build         (custom domain or root host)
const PUBLIC_BASE = process.env.PUBLIC_BASE || '/';

export default defineConfig({
  base: PUBLIC_BASE,
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Śaṅkara-bhāṣya-pārāyaṇāñjali',
        short_name: 'Pārāyaṇāñjali',
        description:
          "Offline reader for Ādi Śaṅkarācārya's Prasthāna-trayī Bhāṣyas — Sanskrit recitation with multi-script transliteration, full-text search, and Sanskrit dictionary lookup.",
        theme_color: '#6b3410',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Bhashya + dictionary JSON can be tens of MB; lift the per-file cap.
        maximumFileSizeToCacheInBytes: 80 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2,json}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/data/') || url.pathname.startsWith('/images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'bhashya-data',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
  },
});

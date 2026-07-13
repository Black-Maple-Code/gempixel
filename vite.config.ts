/// <reference types="vitest" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { FontaineTransform } from 'fontaine';

export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    FontaineTransform.vite({
      // System fonts used to synthesize the metric-adjusted fallback face.
      fallbacks: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial'],
      // Fontaine must read the actual woff2 to compute Capsize metrics.
      // @fontsource emits url(./files/*.woff2); map that id into node_modules.
      resolvePath: (id) => new URL(`../node_modules/@fontsource${id}`, import.meta.url),
    }),
  ],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync } from 'node:fs';

const legacyAssets = {
  name: 'card-wizard-legacy-assets',
  apply: 'build' as const,
  buildStart(this: { emitFile: (asset: { type: 'asset'; fileName: string; source: Buffer }) => void }) {
    for (const fileName of readdirSync('.').filter((file) => file.endsWith('.js'))) {
      this.emitFile({ type: 'asset', fileName, source: readFileSync(fileName) });
    }
  },
};

export default defineConfig({
  plugins: [react(), legacyAssets],
  css: { postcss: { plugins: [] } },
  build: { sourcemap: true, rollupOptions: { input: { main: 'index.html', legacy: 'legacy.html' } } },
});

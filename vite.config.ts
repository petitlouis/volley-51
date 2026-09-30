import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  // Le numéro de version affiché dans le pied de page vient de package.json.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: { include: ['src/**/*.test.ts'] },
});

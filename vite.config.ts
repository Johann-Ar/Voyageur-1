/**
 * Vite — site statique. `base: './'` : les chemins restent relatifs, le site marche à la racine
 * d'un domaine comme dans un sous-dossier (GitHub Pages).
 */
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  server: { port: 5177 },
});

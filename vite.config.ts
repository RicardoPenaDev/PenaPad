import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // Acesso direto aos módulos ESM do Monaco (para importar só o necessário)
  resolve: { alias: { 'monaco-esm': fileURLToPath(new URL('./node_modules/monaco-editor/esm/vs', import.meta.url)) } },
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, target: 'safari15', chunkSizeWarningLimit: 8000 },
  worker: { format: 'es' },
});

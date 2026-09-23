import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(frontendRoot, 'app');

export default defineConfig({
  plugins: [react()],
  root: appRoot,
  // Documentation is a repository concern, not a runtime frontend asset.
  // Keeping the build independent of ../docs makes the Docker frontend stage
  // reproducible with the current .dockerignore.
  publicDir: false,
  resolve: {
    alias: {
      '@': resolve(appRoot, 'src'),
    },
  },
  build: {
    outDir: resolve(frontendRoot, 'dist'),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});

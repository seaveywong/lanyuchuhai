import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const surface = env.VITE_APP_SURFACE === 'admin' ? 'admin' : 'public';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@surface/App': fileURLToPath(new URL(`./src/App.${surface}.jsx`, import.meta.url)),
      },
    },
    server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
    build: { outDir: 'dist', sourcemap: false },
  };
});

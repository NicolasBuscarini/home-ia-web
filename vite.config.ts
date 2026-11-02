import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const target = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8081';
  const monitoringRemote = env.VITE_MONITORING_REMOTE_URL || 'http://127.0.0.1:5174/remoteEntry.js';
  return {
    plugins: [
      react(),
      federation({
        name: 'home_ia_web',
        remotes: {
          monitoring: {
            type: 'module',
            name: 'home_ia_monitoring',
            entry: monitoringRemote,
            entryGlobalName: 'home_ia_monitoring',
            shareScope: 'default',
          },
        },
        shared: ['react', 'react-dom'],
        dts: false,
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      origin: env.VITE_HOST_ORIGIN || 'http://127.0.0.1:5173',
      proxy: {
        '/api': { target, changeOrigin: false },
        '/health': { target, changeOrigin: false },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: { output: { entryFileNames: 'assets/[name]-[hash].js' } },
    },
  };
});

import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const target = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8081';
  const monitoringRemote =
    process.env.VITE_MONITORING_REMOTE_URL ||
    env.VITE_MONITORING_REMOTE_URL ||
    'http://127.0.0.1:5174/remoteEntry.js';
  const platformRemote =
    process.env.VITE_PLATFORM_REMOTE_URL ||
    env.VITE_PLATFORM_REMOTE_URL ||
    'http://127.0.0.1:5175/remoteEntry.js';
  const activityWatchRemote =
    process.env.VITE_ACTIVITYWATCH_REMOTE_URL ||
    env.VITE_ACTIVITYWATCH_REMOTE_URL ||
    'http://127.0.0.1:5176/remoteEntry.js';
  return {
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
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
          platform: {
            type: 'module',
            name: 'home_ia_platform',
            entry: platformRemote,
            entryGlobalName: 'home_ia_platform',
            shareScope: 'default',
          },
          activitywatch: {
            type: 'module',
            name: 'home_ia_activitywatch',
            entry: activityWatchRemote,
            entryGlobalName: 'home_ia_activitywatch',
            shareScope: 'default',
          },
        },
        shared: ['react', 'react-dom', 'home-ia-shared'],
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
    preview: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      cors: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: { output: { entryFileNames: 'assets/[name]-[hash].js' } },
    },
  };
});

import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'home-ia-shared': path.resolve(__dirname, '../home-ia-shared/src/index.ts'),
      'monitoring/MonitoringModule': path.resolve(__dirname, 'tests/monitoringModuleStub.tsx'),
      'platform/AccessModule': path.resolve(__dirname, 'tests/accessModuleStub.tsx'),
      'platform/SystemsModule': path.resolve(__dirname, 'tests/systemsModuleStub.tsx'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
});

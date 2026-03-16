import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/ui/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)', 'infra/tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['e2e/**', 'node_modules/**', 'infra/policy/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/worker/**/*.ts'],
      exclude: ['src/worker/**/*.test.ts', 'src/worker/**/*.spec.ts'],
      thresholds: {
        lines: 75,
        functions: 85,
        branches: 65,
        statements: 75,
      },
    },
  },
});

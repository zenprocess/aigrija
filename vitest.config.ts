import { defineConfig } from 'vitest/config';

export default defineConfig({
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
        lines: 60,
        functions: 70,
        branches: 50,
        statements: 60,
      },
    },
  },
});

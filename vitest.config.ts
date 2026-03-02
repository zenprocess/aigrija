import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)', 'infra/tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['e2e/**', 'node_modules/**', 'infra/policy/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 40,
        functions: 60,
        branches: 30,
        statements: 40,
      },
    },
  },
});

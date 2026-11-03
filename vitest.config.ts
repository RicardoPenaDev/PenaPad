import { defineConfig } from 'vitest/config';

// Vitest só para os testes de unidade (tests/); os de interface (e2e/) rodam no Playwright
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });

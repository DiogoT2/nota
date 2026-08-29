import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
  test: {
    // Lógica pura apenas. Os ecrãs são testados em fluxo pelo agente `qa`.
    // `proto/` é protótipo em quarentena (ADR 0001): não é código do produto e
    // os seus testes não correm no CI.
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'proto/**', 'dist/**'],
  },
});

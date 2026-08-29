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
    // As Edge Functions são Deno, mas o seu núcleo é TypeScript puro sem uma
    // única API do Deno — de propósito, para o CI as poder testar em Vitest
    // sem instalar Deno e sem rede. Ver docs/plano/fase-2.md, decisão D2.
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
    exclude: ['node_modules/**', 'proto/**', 'dist/**'],
  },
});

#!/usr/bin/env node
/**
 * As seis contas do seed conseguem fazer login a sério?
 *
 * Não é uma pergunta redundante. Toda a Fase 1 foi testada com JWT forjados
 * por `scripts/token.mjs`, que passam no PostgREST porque este só verifica a
 * assinatura e a claim `role`. O GoTrue faz mais: lê a linha de `auth.users`,
 * e quatro colunas de token deixadas a NULL fazem-no responder «Database error
 * querying schema» — uma mensagem que não diz nada sobre a causa.
 *
 * Uma conta de teste que não consegue fazer login não serve para testar a app,
 * e a Fase 4 (qa) precisa de sessões reais.
 */
import { Buffer } from 'node:buffer';
import { carregar, exigir } from './ambiente.mjs';

const env = carregar();

const URL_BASE = env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = exigir(env, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');

const CONTAS = ['ana', 'bruno', 'carla', 'david', 'eva', 'fabio'];
const PASSE = 'nota-teste-1234';

let falhas = 0;

for (const handle of CONTAS) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${handle}@nota.test`, password: PASSE }),
  });
  const corpo = await r.json();

  if (!r.ok || typeof corpo.access_token !== 'string') {
    falhas += 1;
    const razao = corpo.error_description ?? corpo.msg ?? `HTTP ${r.status}`;
    process.stderr.write(`FALHA ${handle}: ${razao}\n`);
    continue;
  }

  const claims = JSON.parse(
    Buffer.from(corpo.access_token.split('.')[1], 'base64url').toString(),
  );
  if (claims.role !== 'authenticated' || claims.user_metadata?.handle !== handle) {
    falhas += 1;
    process.stderr.write(
      `FALHA ${handle}: claims inesperadas ${JSON.stringify(claims)}\n`,
    );
    continue;
  }
  process.stdout.write(`ok   ${handle} · sessão real, sub ${claims.sub}\n`);
}

if (falhas > 0) {
  process.stderr.write(`\n${falhas}/${CONTAS.length} contas do seed não fazem login.\n`);
  process.exit(1);
}
process.stdout.write(`\nas ${CONTAS.length} contas do seed fazem login a sério.\n`);

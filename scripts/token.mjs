#!/usr/bin/env node
/**
 * Emite um JWT local para uma das contas de teste.
 *
 *   node scripts/token.mjs ana
 *   curl -H "Authorization: Bearer $(node scripts/token.mjs ana)" ...
 *
 * O segredo é o do Supabase local, que é público e está na documentação. Isto
 * não funciona contra staging nem produção, e é bom que não funcione.
 *
 * Pré-requisito da bateria em `docs/ataque-fase-1.md`: o `rls-adversary` tem de
 * se poder autenticar como qualquer conta sem passar pela app, senão está a
 * testar o cliente e não a base de dados.
 */
import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';

// O segredo do JWT local. Vem do ambiente quando lá estiver; o valor por
// omissão é o que o `supabase start` usa e está na documentação pública do
// Supabase. Não funciona contra staging nem produção, e é bom que não funcione.
const SEGREDO =
  process.env.SUPABASE_JWT_SECRET ??
  'super-secret-jwt-token-with-at-least-32-characters-long';

export const CONTAS = {
  ana: '11111111-1111-1111-1111-111111111111',
  bruno: '22222222-2222-2222-2222-222222222222',
  carla: '33333333-3333-3333-3333-333333333333',
  david: '44444444-4444-4444-4444-444444444444',
  eva: '55555555-5555-5555-5555-555555555555',
  fabio: '66666666-6666-6666-6666-666666666666',
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/**
 * @param {string} handle uma das contas, ou `anon`
 * @param {{ expirado?: boolean, segredo?: string, role?: string }} [opcoes]
 */
export function token(handle, opcoes = {}) {
  const agora = Math.floor(Date.now() / 1000);
  const claims =
    handle === 'anon'
      ? { role: 'anon' }
      : { sub: CONTAS[handle] ?? handle, role: opcoes.role ?? 'authenticated' };

  const payload = {
    iss: 'supabase-demo',
    ...claims,
    iat: agora,
    exp: opcoes.expirado ? agora - 60 : agora + 3600,
  };

  const cabecalho = b64({ alg: 'HS256', typ: 'JWT' });
  const corpo = b64(payload);
  const assinatura = createHmac('sha256', opcoes.segredo ?? SEGREDO)
    .update(`${cabecalho}.${corpo}`)
    .digest('base64url');

  return `${cabecalho}.${corpo}.${assinatura}`;
}

// pathToFileURL e não uma comparação de strings: em Windows o caminho de
// process.argv[1] vem com barras invertidas e o prefixo file:// fica com uma
// barra a menos, por isso a comparação directa falhava em silêncio — o script
// corria, não imprimia nada, e saía com código 0.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const handle = process.argv[2];
  if (!handle) {
    process.stderr.write(
      `uso: node scripts/token.mjs <${Object.keys(CONTAS).join('|')}|anon>\n`,
    );
    process.exit(1);
  }
  process.stdout.write(token(handle) + '\n');
}

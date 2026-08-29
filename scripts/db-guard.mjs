#!/usr/bin/env node
/**
 * F0-7. `db:reset` apaga a base inteira. Este guarda recusa-se a correr se o
 * alvo não for local ou de staging.
 *
 * A defesa não é lembrar-se de verificar a variável de ambiente antes de
 * carregar no Enter. É o script recusar.
 */
const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? '';
const permitido = process.env.NOTA_ENV ?? 'local';

const eLocal = /(^$)|(127\.0\.0\.1|localhost|host\.docker\.internal)/.test(url);
const eStaging = /staging/.test(url) || permitido === 'staging';

if (!eLocal && !eStaging) {
  process.stderr.write(
    `db:reset recusado.\n` +
      `  alvo:    ${url.replace(/:[^:@/]*@/, ':***@') || '(vazio)'}\n` +
      `  NOTA_ENV: ${permitido}\n` +
      `Só corre contra local ou staging. Produção não se reinicia.\n`,
  );
  process.exit(1);
}

if (eStaging && !eLocal) {
  process.stdout.write('atenção: alvo é staging, não local. A prosseguir.\n');
}

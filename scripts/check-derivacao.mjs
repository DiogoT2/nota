#!/usr/bin/env node
/**
 * A derivação da nota existe em dois sítios: na vista `scores` em SQL, porque
 * é de lá que o cliente lê, e em `src/ranking/derivar.ts`, porque o cliente
 * precisa de mostrar a nota antes de a gravar.
 *
 * Duas implementações da mesma regra divergem. Não é uma hipótese, é uma
 * questão de tempo — e a divergência aqui seria invisível: as duas continuam a
 * devolver números plausíveis dentro do intervalo certo, e ninguém repara até
 * alguém comparar o que a app mostrou com o que ficou gravado.
 *
 * Este script corre as duas com os mesmos dados e compara valor a valor.
 * Popula um utilizador descartável com todos os tamanhos de balde de 1 a 12,
 * lê a vista, e confronta com o TypeScript.
 *
 * Precisa da base local a correr. Corre no CI, no job da base de dados.
 */
import pg from 'pg';
import { carregar, exigir } from './ambiente.mjs';

const env = carregar();
const URL = exigir(env, 'DATABASE_URL');

// Um utilizador só deste teste. Não toca no seed nem nas contas de ataque.
const UTILIZADOR = '0de11ada-0000-4000-8000-000000000001';
const BALDES = ['nah', 'gostei', 'adorei'];
const TAMANHOS = [1, 2, 3, 4, 5, 6, 7, 9, 12];

// Import directo do módulo do motor. O Node 22 lê TypeScript com
// `--experimental-strip-types`, que é como o `npm run check:derivacao` o
// invoca. Copiar a fórmula para aqui seria cometer o erro que este script
// existe para apanhar.
const { derivarBalde } = await import('../src/ranking/derivar.ts');

const cliente = new pg.Client({ connectionString: URL });
await cliente.connect();

async function preparar() {
  await cliente.query('begin');
  await cliente.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                             email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                             created_at, updated_at,
                             confirmation_token, recovery_token, email_change,
                             email_change_token_new)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated',
             'authenticated', 'derivacao@nota.test', '', now(),
             '{"provider":"email","providers":["email"]}'::jsonb,
             '{"handle":"derivacao"}'::jsonb, now(), now(), '', '', '', '')
     on conflict (id) do nothing`,
    [UTILIZADOR],
  );

  let seq = 0;
  for (const balde of BALDES) {
    for (const n of TAMANHOS) {
      // Cada combinação (balde, tamanho) precisa de um âmbito próprio para os
      // tamanhos não se misturarem. Usa-se um scope_id de episódios, que é o
      // único âmbito com chave livre.
      const scope = `0000${String(seq).padStart(4, '0')}-0000-4000-8000-000000000000`;
      seq += 1;
      for (let i = 0; i < n; i += 1) {
        const subject = `1111${String(seq).padStart(4, '0')}-0000-4000-8000-${String(i).padStart(12, '0')}`;
        await cliente.query(
          `insert into public.buckets (user_id, subject_type, subject_id, bucket)
           values ($1, 'episode', $2, $3)`,
          [UTILIZADOR, subject, balde],
        );
        await cliente.query(
          `insert into public.rank_positions
             (user_id, subject_type, scope_id, subject_id, position)
           values ($1, 'episode', $2, $3, $4)`,
          [UTILIZADOR, scope, subject, (i + 1) * 1024],
        );
      }
    }
  }
}

let divergencias = 0;

try {
  await preparar();

  const { rows } = await cliente.query(
    `select scope_id, bucket::text as bucket, position, score::float8 as score
       from public.scores
      where user_id = $1
      order by scope_id, position`,
    [UTILIZADOR],
  );

  const porAmbito = new Map();
  for (const r of rows) {
    const lista = porAmbito.get(r.scope_id);
    if (lista === undefined) porAmbito.set(r.scope_id, [r]);
    else lista.push(r);
  }

  for (const [scope, lista] of porAmbito) {
    const balde = lista[0].bucket;
    const doSql = lista.map((r) => r.score);
    const doTs = derivarBalde(balde, lista.length);

    if (JSON.stringify(doSql) !== JSON.stringify(doTs)) {
      divergencias += 1;
      process.stderr.write(
        `DIVERGE  ${balde} com ${lista.length} títulos (âmbito ${scope})\n` +
          `  SQL: ${doSql.join(' ')}\n` +
          `  TS : ${doTs.join(' ')}\n`,
      );
    }
  }

  const total = porAmbito.size;
  if (divergencias > 0) {
    process.stderr.write(
      `\n${divergencias}/${total} combinações divergem entre a vista scores e\n` +
        'src/ranking/derivar.ts. A app mostraria uma nota e gravaria outra.\n',
    );
  } else {
    process.stdout.write(
      `${total} combinações de balde e tamanho: a vista SQL e o TypeScript dão\n` +
        'exactamente a mesma nota.\n',
    );
  }
} finally {
  // Nunca commita: o utilizador de teste não fica na base.
  await cliente.query('rollback');
  await cliente.end();
}

process.exit(divergencias > 0 ? 1 : 0);

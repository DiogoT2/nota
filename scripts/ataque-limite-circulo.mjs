#!/usr/bin/env node
/**
 * O ataque do 30.º e do 31.º membro em simultâneo.
 *
 * Este é o único teste da Fase 1 que não cabe em pgTAP. O pg_prove corre tudo
 * numa sessão só, e uma sessão só nunca tem duas transacções ao mesmo tempo —
 * portanto um teste pgTAP do limite de 30 verifica o CHECK e nada mais. O modo
 * de falha que interessa é outro: duas transacções concorrentes que leem o
 * mesmo estado e ambas concluem que há espaço.
 *
 * O que se está a provar: com `update profiles set circle_count = ...` no
 * trigger, o UPDATE toma um lock de linha e a segunda transacção espera. Se em
 * vez disso o trigger fizesse `select count(*) from circle_members`, ambas
 * leriam 29 em read committed, ambas passariam, e o Círculo ficava com 31
 * pessoas sem um único erro no log.
 *
 * Corre 20 vezes porque uma corrida ganha uma vez não prova nada.
 */
import pg from 'pg';

const URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const RONDAS = Number(process.env.RONDAS ?? 20);

const ANA = '11111111-1111-1111-1111-111111111111';

async function q(cliente, sql, params) {
  return cliente.query(sql, params);
}

/** Enche o Círculo da ana até `quantos` e devolve os dois candidatos a seguir. */
async function preparar(admin, quantos) {
  await q(admin, 'delete from public.circle_members where owner_id = $1', [ANA]);
  await q(admin, "delete from auth.users where email like 'corrida%@nota.test'");

  const ids = [];
  for (let i = 0; i < quantos + 2; i += 1) {
    const id = `9${String(i).padStart(7, '0')}-0000-4000-8000-000000000000`;
    ids.push(id);
    await q(
      admin,
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                               email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                               created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated',
               'authenticated', $2, '', now(),
               '{"provider":"email","providers":["email"]}'::jsonb,
               jsonb_build_object('handle', $3::text), now(), now())`,
      [id, `corrida${i}@nota.test`, `corrida${i}`],
    );
    await q(
      admin,
      'insert into public.follows (follower_id, followee_id) values ($1, $2)',
      [id, ANA],
    );
    await q(
      admin,
      'insert into public.follows (follower_id, followee_id) values ($1, $2)',
      [ANA, id],
    );
    await q(
      admin,
      `update public.follows set state = 'active'
        where follower_id = $1 and followee_id = $2`,
      [ANA, id],
    );
  }

  // Enche até `quantos`. Sobram dois para a corrida.
  for (let i = 0; i < quantos; i += 1) {
    await q(
      admin,
      'insert into public.circle_members (owner_id, member_id) values ($1, $2)',
      [ANA, ids[i]],
    );
  }
  return [ids[quantos], ids[quantos + 1]];
}

/** Uma transacção que tenta entrar no Círculo, com um ponto de encontro. */
async function candidato(url, membro, largada) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    await c.query('begin');
    // As duas transacções abrem primeiro e só depois inserem, para que a
    // sobreposição seja real e não um artefacto do tempo de ligação.
    await largada;
    await c.query(
      'insert into public.circle_members (owner_id, member_id) values ($1, $2)',
      [ANA, membro],
    );
    await c.query('commit');
    return { ok: true };
  } catch (erro) {
    await c.query('rollback').catch(() => {});
    return { ok: false, erro: erro.message.split('\n')[0] };
  } finally {
    await c.end();
  }
}

async function main() {
  const admin = new pg.Client({ connectionString: URL });
  await admin.connect();

  let falhas = 0;

  for (let ronda = 1; ronda <= RONDAS; ronda += 1) {
    const [a, b] = await preparar(admin, 29);

    let disparar;
    const largada = new Promise((r) => {
      disparar = r;
    });
    const corrida = Promise.all([candidato(URL, a, largada), candidato(URL, b, largada)]);
    disparar();
    const [r1, r2] = await corrida;

    const { rows } = await q(
      admin,
      'select circle_count from public.profiles where id = $1',
      [ANA],
    );
    const contador = rows[0].circle_count;
    const { rows: reais } = await q(
      admin,
      'select count(*)::int as n from public.circle_members where owner_id = $1',
      [ANA],
    );

    const passaram = [r1, r2].filter((r) => r.ok).length;
    const bem = passaram === 1 && contador === 30 && reais[0].n === 30;

    if (!bem) {
      falhas += 1;
      process.stderr.write(
        `ronda ${ronda}: FALHA — ${passaram} transacções passaram, ` +
          `contador ${contador}, membros reais ${reais[0].n}\n` +
          `  a: ${r1.ok ? 'commit' : r1.erro}\n  b: ${r2.ok ? 'commit' : r2.erro}\n`,
      );
    }
  }

  // Limpar o que se semeou, para o próximo `db reset` não ser a única forma de
  // repor a base num estado conhecido.
  await q(admin, 'delete from public.circle_members where owner_id = $1', [ANA]);
  await q(admin, "delete from auth.users where email like 'corrida%@nota.test'");
  await admin.end();

  if (falhas > 0) {
    process.stderr.write(`\n${falhas}/${RONDAS} rondas deixaram passar as duas.\n`);
    process.stderr.write('O limite de 30 não resiste a escritas em simultâneo.\n');
    process.exit(1);
  }

  process.stdout.write(
    `${RONDAS}/${RONDAS} rondas: exactamente uma transacção passou, o Círculo ficou com 30.\n`,
  );
}

main().catch((erro) => {
  process.stderr.write(`${erro.stack}\n`);
  process.exit(1);
});

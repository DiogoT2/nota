#!/usr/bin/env node
/**
 * F1-7. Uma função `security definer` corre com os privilégios de quem a criou
 * e ignora a RLS de quem a chama. É a única forma legítima de furar as
 * políticas deste esquema, e por isso cada uma precisa de justificação escrita.
 *
 * A lista das funções vem de `pg_proc`, não de uma leitura dos ficheiros de
 * migração. A primeira versão deste script fazia parsing do SQL e dava falsos
 * positivos — apanhava a expressão «security definer» nos comentários que
 * explicam por que razão uma função NÃO é definer. Um detector com falsos
 * positivos treina quem o lê a ignorá-lo, que é pior do que não existir.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const ADRS = 'docs/adr';
const URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function textoDosAdrs() {
  if (!existsSync(ADRS)) return '';
  return readdirSync(ADRS)
    .filter((f) => f.endsWith('.md'))
    .map((f) => readFileSync(join(ADRS, f), 'utf8'))
    .join('\n');
}

const cliente = new pg.Client({ connectionString: URL });
await cliente.connect();

const { rows } = await cliente.query(`
  select p.proname as nome,
         p.proconfig is not null
           and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
           as tem_search_path
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
   order by p.proname
`);
await cliente.end();

const adrs = textoDosAdrs();
const semAdr = rows.filter((f) => !adrs.includes(f.nome));
const semSearchPath = rows.filter((f) => !f.tem_search_path);

let falhou = false;

if (semAdr.length > 0) {
  falhou = true;
  process.stderr.write('funções security definer sem ADR:\n');
  for (const f of semAdr) process.stderr.write(`  ${f.nome}()\n`);
  process.stderr.write(
    '\nCada uma precisa de um ADR em docs/adr/ com: por que não pode ser\n' +
      'security invoker, e o que acontece se for mal chamada.\n\n',
  );
}

// Uma `security definer` sem `search_path` fixo é sequestrável por quem consiga
// criar um esquema no caminho de pesquisa. É o vector clássico de escalada.
if (semSearchPath.length > 0) {
  falhou = true;
  process.stderr.write('funções security definer sem search_path fixo:\n');
  for (const f of semSearchPath) process.stderr.write(`  ${f.nome}()\n`);
}

if (falhou) process.exit(1);

process.stdout.write(
  `${rows.length} funções security definer, todas com ADR e search_path fixo:\n` +
    rows.map((f) => `  ${f.nome}()`).join('\n') +
    '\n',
);

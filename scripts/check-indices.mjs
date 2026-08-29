#!/usr/bin/env node
/**
 * F1-6. Cada índice tem de aparecer no plano de uma query real.
 *
 * Um índice que o planeador nunca usa custa em cada escrita e mente sobre o
 * desenho — sugere um padrão de acesso que ninguém tem. Este script lista todos
 * os índices de `public`, corre a query que cada um diz servir, e falha se
 * sobrar algum índice sem query ou alguma query que não use o índice esperado.
 *
 * Excepção, e é uma distinção real e não uma conveniência: um índice que suporta
 * uma chave primária ou uma constraint `unique` existe para garantir
 * correcção, não velocidade. Justifica-se pela constraint, e apagá-lo é apagar
 * a regra. A regra do EXPLAIN aplica-se aos índices criados com `create index`,
 * que existem só por desempenho e são os únicos que podem ser gordura.
 *
 * Foi isto que o script mostrou à primeira execução: para «tenho balde para
 * este título?» o planeador prefere `buckets_por_titulo` ao índice único, e
 * para a posição de um título prefere `rank_positions_por_titulo`. Os índices
 * únicos continuam a ser necessários — mas pela unicidade, não pela leitura.
 *
 * Nota sobre a base de teste: com dezenas de linhas, o planeador escolhe
 * sequential scan por ser genuinamente mais rápido, e isso não diz nada sobre o
 * índice. Por isso corre-se com `enable_seqscan = off`, que força o planeador a
 * mostrar qual seria o índice se a tabela fosse grande. O que este script prova
 * é que o índice é UTILIZÁVEL pela query, não que seja escolhido hoje.
 */
import pg from 'pg';

const URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const ANA = '11111111-1111-1111-1111-111111111111';
const FILME = 'aaaa0001-0000-4000-8000-000000000001';
const SERIE = 'bbbb0001-0000-4000-8000-000000000001';

/** índice esperado → a query que ele serve. */
const CASOS = [
  {
    indice: 'profiles_handle_trgm',
    porque: 'pesquisa parcial de handle',
    sql: `select id from public.profiles where handle::text ilike '%an%'`,
  },
  {
    indice: 'follows_recebidos',
    porque: 'pedidos pendentes recebidos',
    sql: `select follower_id from public.follows
           where followee_id = '${ANA}' and state = 'pending'`,
  },
  {
    indice: 'follows_enviados',
    porque: 'quem eu sigo, usado em visible_profile',
    sql: `select followee_id from public.follows
           where follower_id = '${ANA}' and state = 'active'`,
  },
  {
    indice: 'blocks_ao_contrario',
    porque: 'bloqueio na direcção «bloquearam-me» — a outra metade de blocked()',
    sql: `select 1 from public.blocks where blocked_id = '${ANA}'`,
  },
  {
    indice: 'reports_abertas',
    porque: 'fila de moderação',
    sql: `select id from public.reports where state = 'open' order by created_at`,
  },
  {
    indice: 'reports_expiram',
    porque: 'expurgo de retenção',
    sql: `select id from public.reports where expires_at < now()`,
  },
  {
    indice: 'moderation_audit_expiram',
    porque: 'expurgo de retenção',
    sql: `select id from public.moderation_audit where expires_at < now()`,
  },
  {
    indice: 'buckets_por_titulo',
    porque: 'quem avaliou este título',
    sql: `select user_id from public.buckets
           where subject_type = 'movie' and subject_id = '${FILME}'`,
  },
  {
    // Índice de constraint, mas declarado à mesma: a unicidade diferida da
    // posição é também o índice que serve a leitura do ranking pessoal, e
    // convém que isso seja verdade e não suposição.
    indice: 'rank_positions_posicao_unica',
    porque: 'o ranking pessoal de um âmbito, já ordenado',
    sql: `select subject_id from public.rank_positions
           where user_id = '${ANA}' and subject_type = 'episode' and scope_id = '${SERIE}'
           order by position`,
  },
  {
    indice: 'rank_positions_por_titulo',
    porque: 'as notas de um título dadas por outras pessoas',
    sql: `select user_id from public.rank_positions
           where subject_type = 'movie' and subject_id = '${FILME}'`,
  },
  {
    indice: 'rank_positions_feed',
    porque: 'o feed do Círculo, por ordem de chegada',
    sql: `select subject_id from public.rank_positions
           where user_id = any (array['${ANA}']::uuid[])
           order by user_id, created_at desc limit 20`,
  },
  {
    indice: 'replies_por_nota',
    porque: 'as respostas de uma nota, por ordem',
    sql: `select body from public.replies
           where target_user_id = '${ANA}' and target_subject_type = 'movie'
             and target_subject_id = '${FILME}' order by created_at`,
  },
  {
    indice: 'reactions_por_nota',
    porque: 'as reacções de uma nota',
    sql: `select kind from public.reactions
           where target_user_id = '${ANA}' and target_subject_type = 'movie'
             and target_subject_id = '${FILME}'`,
  },
  {
    indice: 'taste_match_lado_b',
    porque: 'taste match, segundo papel — o par é canónico, é preciso procurar nos dois',
    sql: `select affinity from public.taste_match where user_b = '${ANA}'`,
  },
];

/** Todos os nomes de índice que aparecem num plano, a qualquer profundidade. */
function indicesNoPlano(no, achados = new Set()) {
  if (no === null || typeof no !== 'object') return achados;
  if (Array.isArray(no)) {
    for (const filho of no) indicesNoPlano(filho, achados);
    return achados;
  }
  if (typeof no['Index Name'] === 'string') achados.add(no['Index Name']);
  for (const valor of Object.values(no)) indicesNoPlano(valor, achados);
  return achados;
}

const cliente = new pg.Client({ connectionString: URL });
await cliente.connect();

// Sem isto, uma base de teste com dezenas de linhas responde sempre com
// sequential scan e o resultado não diria nada sobre o índice.
await cliente.query('set enable_seqscan = off');

// Índices que suportam uma constraint: justificados pela constraint.
const { rows: existentes } = await cliente.query(`
  select i.relname as nome,
         exists (select 1 from pg_constraint con where con.conindid = i.oid) as de_constraint
    from pg_class i
    join pg_namespace n on n.oid = i.relnamespace
   where n.nspname = 'public' and i.relkind = 'i'
   order by i.relname
`);
const nomes = new Set(existentes.map((r) => r.nome));
const porDesempenho = existentes.filter((r) => !r.de_constraint).map((r) => r.nome);
const deConstraint = existentes.filter((r) => r.de_constraint).length;

const naoUsados = [];
const inexistentes = [];

for (const caso of CASOS) {
  if (!nomes.has(caso.indice)) {
    inexistentes.push(caso.indice);
    continue;
  }
  const { rows } = await cliente.query(`explain (format json) ${caso.sql}`);
  const usados = indicesNoPlano(rows[0]['QUERY PLAN']);
  if (!usados.has(caso.indice)) {
    naoUsados.push({ ...caso, usados: [...usados] });
  }
}

const semCaso = porDesempenho.filter((n) => !CASOS.some((c) => c.indice === n));

await cliente.end();

let falhou = false;

if (inexistentes.length > 0) {
  falhou = true;
  process.stderr.write(`índices referidos aqui mas inexistentes na base:\n`);
  for (const n of inexistentes) process.stderr.write(`  ${n}\n`);
}

if (naoUsados.length > 0) {
  falhou = true;
  process.stderr.write(`\níndices que o EXPLAIN não usa na query que dizem servir:\n`);
  for (const c of naoUsados) {
    process.stderr.write(`  ${c.indice} (${c.porque})\n`);
    process.stderr.write(`    plano usou: ${c.usados.join(', ') || 'nenhum índice'}\n`);
  }
  process.stderr.write('\nOu a query está errada, ou o índice não serve para nada.\n');
}

if (semCaso.length > 0) {
  falhou = true;
  process.stderr.write(
    `\níndices sem query declarada — nomeia a query ou apaga o índice:\n`,
  );
  for (const n of semCaso) process.stderr.write(`  ${n}\n`);
}

if (falhou) process.exit(1);

process.stdout.write(
  `${CASOS.length} índices de desempenho, cada um usado pelo EXPLAIN da query que serve.\n` +
    `${deConstraint} índices de constraint, justificados pela chave que garantem.\n`,
);

#!/usr/bin/env node
/**
 * Verifica que o `.env` está completo e que os valores funcionam.
 *
 * Não imprime um único segredo. Diz o nome da variável, se está presente, e se
 * a credencial responde ao serviço a que pertence — que é a única coisa que
 * interessa saber. Um valor com o comprimento certo e a origem errada passa
 * numa inspecção visual e falha na primeira chamada real.
 *
 * Critério de aceitação da Fase 0: alguém clona o repositório, corre
 * `npm install && npm run db:start`, copia o `.env.example` e isto passa.
 */
import { readFileSync, existsSync } from 'node:fs';

const P = '.env';

const ESPERADAS = [
  { nome: 'EXPO_PUBLIC_SUPABASE_URL', publica: true, o_que: 'porta da API do Supabase' },
  {
    nome: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    publica: true,
    o_que: 'chave anon — vai no bundle, por desenho',
  },
  {
    nome: 'SUPABASE_SERVICE_ROLE_KEY',
    publica: false,
    o_que: 'ignora a RLS; só servidor',
  },
  { nome: 'DATABASE_URL', publica: false, o_que: 'ligação directa ao Postgres' },
  {
    nome: 'TMDB_READ_ACCESS_TOKEN',
    publica: false,
    o_que: 'token v4 do TMDB, em cabeçalho Bearer',
  },
  { nome: 'TMDB_API_KEY', publica: false, o_que: 'chave v3 do TMDB (alternativa ao v4)' },
];

if (!existsSync(P)) {
  process.stderr.write('não existe .env. Copia o .env.example e preenche.\n');
  process.exit(1);
}

const bruto = readFileSync(P, 'utf8');
const env = {};
for (const linha of bruto.split(/\r?\n/)) {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(linha);
  if (m) env[m[1]] = m[2].trim();
}

// Uma última linha sem newline é descartada por muitas ferramentas que leem
// ficheiros de ambiente linha a linha — incluindo `while read` em shell. O
// sintoma é uma variável que existe no editor e "não existe" para o programa.
if (bruto.length > 0 && !bruto.endsWith('\n')) {
  process.stdout.write(
    'aviso: o .env não termina em newline. A última variável é invisível para\n' +
      '       ferramentas que leem linha a linha. Acrescenta uma linha em branco.\n\n',
  );
}

const faltam = ESPERADAS.filter((v) => !env[v.nome]);
if (faltam.length > 0) {
  process.stderr.write('variáveis em falta ou vazias:\n');
  for (const v of faltam) process.stderr.write(`  ${v.nome} — ${v.o_que}\n`);
  process.exit(1);
}

const resultados = [];
async function verificar(nome, fn) {
  try {
    const { ok, detalhe } = await fn();
    resultados.push({ nome, ok, detalhe });
  } catch (erro) {
    resultados.push({ nome, ok: false, detalhe: erro.message });
  }
}

await verificar('Supabase · chave anon fala com o PostgREST', async () => {
  const r = await fetch(
    `${env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/titles?select=id&limit=1`,
    {
      headers: {
        apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    },
  );
  // 200 com [] é o correcto: `anon` autentica mas a RLS não lhe dá nada.
  return { ok: r.status === 200, detalhe: `HTTP ${r.status}` };
});

await verificar('Supabase · service_role ignora a RLS, como deve', async () => {
  const r = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/titles?select=id`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const linhas = r.status === 200 ? (await r.json()).length : 0;
  return { ok: linhas > 0, detalhe: `HTTP ${r.status}, ${linhas} títulos` };
});

await verificar('Postgres · DATABASE_URL liga', async () => {
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: env.DATABASE_URL });
  await c.connect();
  const { rows } = await c.query(
    `select count(*)::int as n from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relkind = 'r'`,
  );
  await c.end();
  return { ok: rows[0].n > 0, detalhe: `${rows[0].n} tabelas em public` };
});

await verificar('TMDB · token v4 (Bearer)', async () => {
  const r = await fetch('https://api.themoviedb.org/3/authentication', {
    headers: { Authorization: `Bearer ${env.TMDB_READ_ACCESS_TOKEN}` },
  });
  return { ok: r.status === 200, detalhe: `HTTP ${r.status}` };
});

await verificar('TMDB · chave v3 (query string)', async () => {
  const r = await fetch(
    `https://api.themoviedb.org/3/authentication?api_key=${env.TMDB_API_KEY}`,
  );
  return { ok: r.status === 200, detalhe: `HTTP ${r.status}` };
});

for (const r of resultados) {
  process.stdout.write(`${r.ok ? 'ok  ' : 'FALHA'} ${r.nome} · ${r.detalhe}\n`);
}

const falhas = resultados.filter((r) => !r.ok);
if (falhas.length > 0) {
  process.stderr.write(`\n${falhas.length} credenciais não respondem.\n`);
  process.exit(1);
}

process.stdout.write('\nambiente completo e a funcionar.\n');

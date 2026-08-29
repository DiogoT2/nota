#!/usr/bin/env node
/**
 * Proibição permanente: nenhum segredo no bundle.
 *
 * Não confia em revisão de código. Exporta o bundle a sério com
 * `expo export` e procura os valores dentro do output. Se um segredo lá
 * estiver, está no telemóvel de quem instalar a app.
 *
 * Corre no CI. Falhar aqui bloqueia o merge.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist';

/** Variáveis cujo valor nunca pode aparecer no bundle. */
const PROIBIDAS = ['SUPABASE_SERVICE_ROLE_KEY', 'TMDB_API_KEY', 'TMDB_READ_ACCESS_TOKEN'];

/** Padrões que denunciam um segredo mesmo sem saber o valor exacto. */
const PADROES = [
  {
    nome: 'chave service_role (JWT com role service_role)',
    re: /"?role"?\s*:\s*"?service_role/,
  },
  { nome: 'endpoint do TMDB', re: /api\.themoviedb\.org|api\.tmdb\.org/i },
  { nome: 'chave de API do TMDB em query string', re: /[?&]api_key=[A-Za-z0-9]{16,}/ },
  {
    nome: 'nome de variável de servidor',
    re: /SUPABASE_SERVICE_ROLE_KEY|TMDB_(API_KEY|READ_ACCESS_TOKEN)/,
  },
];

function ficheiros(dir) {
  const saida = [];
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...ficheiros(caminho));
    else saida.push(caminho);
  }
  return saida;
}

function exportar() {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
  process.stdout.write('a exportar o bundle…\n');
  try {
    execFileSync('npx', ['expo', 'export', '--platform', 'all', '--output-dir', OUT], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  } catch {
    // O erro do bundler já foi impresso acima por `stdio: inherit`. Deixar o
    // Node despejar aqui a sua stack por cima só afasta a mensagem que
    // interessa do fim do output, que é onde se olha primeiro.
    process.stderr.write('\nO bundle não foi produzido. O erro do Metro está acima.\n');
    process.exit(1);
  }
}

function main() {
  exportar();

  const valores = PROIBIDAS.map((nome) => [nome, process.env[nome]]).filter(
    ([, valor]) => typeof valor === 'string' && valor.length >= 8,
  );

  const achados = [];
  for (const caminho of ficheiros(OUT)) {
    let texto;
    try {
      texto = readFileSync(caminho, 'utf8');
    } catch {
      continue; // binário
    }
    for (const [nome, valor] of valores) {
      if (texto.includes(valor)) achados.push(`${caminho}: valor de ${nome}`);
    }
    for (const { nome, re } of PADROES) {
      const m = re.exec(texto);
      if (m) achados.push(`${caminho}: ${nome} — «${m[0].slice(0, 60)}»`);
    }
  }

  if (achados.length > 0) {
    process.stderr.write('\nSEGREDO NO BUNDLE — proibição permanente do CLAUDE.md:\n');
    for (const a of achados) process.stderr.write(`  ${a}\n`);
    process.exit(1);
  }

  const verificados = valores.length;
  process.stdout.write(
    `bundle limpo: ${PADROES.length} padrões e ${verificados} valores de ambiente verificados\n`,
  );
  if (verificados === 0) {
    process.stdout.write(
      'aviso: nenhuma variável de servidor definida no ambiente, só os padrões foram testados\n',
    );
  }
}

main();

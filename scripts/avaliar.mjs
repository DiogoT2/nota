#!/usr/bin/env node
/**
 * F3-10 · Aceitação da Fase 3: avaliar 30 títulos reais à mão.
 *
 * «Se cansar, o algoritmo muda antes de a fase fechar.» É o único critério
 * desta fase que não se automatiza, e é o que decide se o produto existe: a
 * regra 4 diz que a nota é derivada de comparações, e se comparar for chato
 * ninguém dá notas nenhumas.
 *
 * Isto não é a app. É o fluxo despido de UI, para se sentir o essencial hoje,
 * meses antes de a Fase 5 existir. Usa o motor a sério — `src/ranking/` — e
 * títulos a sério do TMDB.
 *
 * Tecla única, sem Enter: a fricção de carregar Enter a cada resposta não faz
 * parte do produto e falsearia a medição.
 *
 * No fim grava `.aceitacao.json` com tudo o que se passou — quantas
 * comparações por título, quanto tempo cada uma demorou, quantos «não sei».
 * Uma impressão sobre se cansou vale menos do que o número de segundos que
 * cada resposta demorou a chegar.
 */
import { writeFileSync } from 'node:fs';
import { stdin, stdout } from 'node:process';
import { carregar, exigir } from './ambiente.mjs';
import { avaliar, responderA, notas } from '../src/ranking/motor.ts';

const env = carregar();
const TOKEN = exigir(env, 'TMDB_READ_ACCESS_TOKEN');
const ALVO = Number(process.argv[2] ?? 30);

/**
 * Teclas guionadas, para poder correr o fluxo inteiro sem terminal.
 *
 * Existe para eu não entregar um programa que nunca vi correr — e para o dia
 * em que este ecrã for testado a sério. Não é modo de uso: sem isto definido, o
 * programa exige um TTY.
 */
const GUIAO = process.env.NOTA_TECLAS ? [...process.env.NOTA_TECLAS] : null;
let guiaoI = 0;

// ── Aparência ────────────────────────────────────────────────────────────────

const cor = {
  reset: '[0m',
  brasa: '[38;5;202m',
  claro: '[38;5;255m',
  medio: '[38;5;250m',
  fraco: '[38;5;244m',
  apagado: '[38;5;240m',
};
const c = (t, k) => `${cor[k]}${t}${cor.reset}`;
const limpar = () => stdout.write('[2J[H');

// ── Uma tecla, sem Enter ─────────────────────────────────────────────────────

function tecla(aceites) {
  // `aceites` a null significa qualquer tecla.
  if (GUIAO !== null) {
    const k = GUIAO[guiaoI % GUIAO.length];
    guiaoI += 1;
    if (aceites !== null && !aceites.includes(k)) return Promise.resolve(aceites[0]);
    return Promise.resolve(k);
  }
  if (!stdin.isTTY) {
    throw new Error(
      'isto precisa de um terminal a sério: corre `npm run avaliar` directamente, ' +
        'não através de um pipe nem de um runner que capture o stdout.',
    );
  }
  return new Promise((resolve) => {
    stdin.setRawMode(true);
    stdin.resume();
    const ouvir = (buf) => {
      const k = buf.toString();
      // Ctrl+C em raw mode não gera SIGINT: tem de ser tratado à mão, senão a
      // única saída é fechar o terminal.
      if (k === '') {
        stdin.setRawMode(false);
        stdout.write('\n');
        process.exit(130);
      }
      const t = k.toLowerCase();
      if (aceites !== null && !aceites.includes(t)) return;
      stdin.removeListener('data', ouvir);
      stdin.setRawMode(false);
      stdin.pause();
      resolve(t);
    };
    stdin.on('data', ouvir);
  });
}

// ── TMDB ─────────────────────────────────────────────────────────────────────

/**
 * O conjunto de onde saem os títulos.
 *
 * `top_rated` e não `popular`: o «popular» do TMDB são as estreias do mês, e
 * uma bateria de trinta filmes que ninguém viu mede a paciência para carregar
 * em «não vi», não o cansaço de comparar. Os mais bem votados de sempre
 * atravessam décadas e são filmes que se têm hipótese de ter visto.
 */
async function poolDoTmdb(paginas = 8) {
  const filmes = [];
  for (let p = 1; p <= paginas; p += 1) {
    const r = await fetch(
      `https://api.themoviedb.org/3/movie/top_rated?language=pt-PT&page=${p}`,
      { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' } },
    );
    if (!r.ok) throw new Error(`TMDB respondeu ${r.status}`);
    const j = await r.json();
    const limite = new Date().getUTCFullYear() - 1;
    for (const f of j.results ?? []) {
      const ano = Number((f.release_date ?? '').slice(0, 4));
      // Fora as estreias dos últimos dois anos. O `top_rated` do TMDB deixa-as
      // subir com poucos votos, e trinta filmes por ver medem a paciência para
      // carregar em «não vi», não o cansaço de comparar.
      if (f.title && Number.isFinite(ano) && ano <= limite) {
        filmes.push({
          id: String(f.id),
          titulo: f.title,
          ano: (f.release_date ?? '').slice(0, 4) || '—',
        });
      }
    }
  }

  // Baralhado com semente fixa: a mesma ordem em cada corrida, para duas
  // sessões serem comparáveis, mas sem ser a ordem do ranking do TMDB — que
  // apresentaria os melhores primeiro e enviesaria os baldes logo à partida.
  let s = 20260830;
  for (let i = filmes.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [filmes[i], filmes[j]] = [filmes[j], filmes[i]];
  }
  return filmes;
}

// ── O fluxo ──────────────────────────────────────────────────────────────────

const NOME_BALDE = { adorei: 'Adorei', gostei: 'Gostei', nah: 'Nah' };

function cabecalho(feitos, total, decorrido) {
  const barra = '█'.repeat(feitos) + '·'.repeat(Math.max(0, total - feitos));
  const min = Math.floor(decorrido / 60000);
  const seg = Math.floor((decorrido % 60000) / 1000);
  stdout.write(
    `${c('NOTA', 'brasa')}  ${c(barra, 'apagado')}  ` +
      `${c(`${feitos}/${total}`, 'fraco')}  ${c(`${min}m${String(seg).padStart(2, '0')}s`, 'apagado')}\n\n`,
  );
}

function mostrarRanking(ambito) {
  const lista = notas(ambito).sort((a, b) => a.posicao - b.posicao);
  if (lista.length === 0) return;
  stdout.write(c('  o teu ranking\n', 'apagado'));
  for (const n of lista.slice(0, 12)) {
    const nome = titulos.get(n.subjectId) ?? n.subjectId;
    stdout.write(
      `  ${c(n.nota.toFixed(1).padStart(4), 'brasa')}  ${c(nome, 'medio')}` +
        `${n.pregado ? c('  ·pregado', 'apagado') : ''}\n`,
    );
  }
  if (lista.length > 12) stdout.write(c(`  … e mais ${lista.length - 12}\n`, 'apagado'));
  stdout.write('\n');
}

const titulos = new Map();
const registo = [];

async function main() {
  stdout.write(c('\n  a ir buscar filmes ao TMDB…\n', 'fraco'));
  const pool = await poolDoTmdb();

  let ambito = [];
  let feitos = 0;
  let indice = 0;
  const inicio = Date.now();

  while (feitos < ALVO && indice < pool.length) {
    const filme = pool[indice];
    indice += 1;
    if (titulos.has(filme.id)) continue;

    limpar();
    cabecalho(feitos, ALVO, Date.now() - inicio);
    mostrarRanking(ambito);

    stdout.write(`  ${c(filme.titulo, 'claro')} ${c(`(${filme.ano})`, 'fraco')}\n\n`);
    stdout.write(
      `  ${c('a', 'brasa')} adorei   ${c('g', 'brasa')} gostei   ` +
        `${c('n', 'brasa')} nah   ${c('s', 'fraco')} não vi   ${c('q', 'fraco')} sair\n`,
    );

    const t0 = Date.now();
    const escolha = await tecla(['a', 'g', 'n', 's', 'q']);
    if (escolha === 'q') break;
    if (escolha === 's') continue;

    const balde = escolha === 'a' ? 'adorei' : escolha === 'g' ? 'gostei' : 'nah';
    titulos.set(filme.id, filme.titulo);

    // ── A sequência de comparações ──
    let passo = avaliar(ambito, filme.id, balde);
    let comparacoes = 0;
    let naoSei = 0;
    const temposDeResposta = [];

    while (passo.tipo === 'pergunta') {
      const contra = titulos.get(passo.contra) ?? passo.contra;
      limpar();
      cabecalho(feitos, ALVO, Date.now() - inicio);

      stdout.write(
        `  ${c(NOME_BALDE[balde], 'apagado')}   ` +
          `${c(`comparação ${passo.numero} de no máximo ${passo.numero + passo.maximoRestante - 1}`, 'apagado')}\n\n`,
      );
      stdout.write(c('  qual é melhor?\n\n', 'fraco'));
      stdout.write(`  ${c('1', 'brasa')}  ${c(filme.titulo, 'claro')}\n`);
      stdout.write(`  ${c('2', 'brasa')}  ${c(contra, 'claro')}\n\n`);
      stdout.write(`  ${c('?', 'fraco')} não sei\n`);

      const tq = Date.now();
      const r = await tecla(['1', '2', '?']);
      temposDeResposta.push(Date.now() - tq);
      comparacoes += 1;
      if (r === '?') naoSei += 1;

      passo = responderA(
        ambito,
        passo.avaliacao,
        r === '1' ? 'novo' : r === '2' ? 'existente' : 'nao-sei',
      );
    }

    ambito = passo.ambito;
    feitos += 1;

    const nota = notas(ambito).find((n) => n.subjectId === filme.id);
    registo.push({
      titulo: filme.titulo,
      balde,
      comparacoes: passo.comparacoes,
      perguntasFeitas: comparacoes,
      naoSei,
      nota: nota?.nota ?? null,
      msTotal: Date.now() - t0,
      msPorResposta: temposDeResposta,
      renumerou: passo.renumerou,
    });

    // Confirmação curta: ver a nota é a recompensa do esforço.
    limpar();
    cabecalho(feitos, ALVO, Date.now() - inicio);
    stdout.write(
      `  ${c(filme.titulo, 'claro')}\n\n` +
        `  ${c((nota?.nota ?? 0).toFixed(1), 'brasa')}   ` +
        `${c(NOME_BALDE[balde], 'fraco')}   ` +
        `${c(`${passo.comparacoes} comparação${passo.comparacoes === 1 ? '' : 'ões'}`, 'apagado')}\n\n`,
    );
    mostrarRanking(ambito);
    stdout.write(c('  qualquer tecla para continuar\n', 'apagado'));
    await tecla('abcdefghijklmnopqrstuvwxyz0123456789 \r\n?'.split(''));
  }

  relatorio(ambito, Date.now() - inicio);
}

function relatorio(ambito, decorrido) {
  limpar();
  const total = registo.length;
  if (total === 0) {
    stdout.write(c('\n  nada avaliado.\n\n', 'fraco'));
    return;
  }

  const comparacoes = registo.reduce((t, r) => t + r.comparacoes, 0);
  const naoSei = registo.reduce((t, r) => t + r.naoSei, 0);
  const respostas = registo.flatMap((r) => r.msPorResposta);
  const mediana = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length === 0 ? 0 : s[Math.floor(s.length / 2)];
  };
  const semZero = registo.filter((r) => r.comparacoes > 0);

  stdout.write(`\n  ${c('ACEITAÇÃO DA FASE 3', 'brasa')}\n\n`);
  stdout.write(`  títulos avaliados        ${c(String(total), 'claro')}\n`);
  stdout.write(
    `  tempo total              ${c(`${Math.round(decorrido / 60000)}m`, 'claro')}` +
      c(`  (${Math.round(decorrido / total / 1000)}s por título)`, 'apagado') +
      '\n',
  );
  stdout.write(`  comparações              ${c(String(comparacoes), 'claro')}\n`);
  stdout.write(
    `  média por título         ${c((comparacoes / total).toFixed(1), 'claro')}\n`,
  );
  stdout.write(
    `  média excluindo os de 0  ${c(
      semZero.length ? (comparacoes / semZero.length).toFixed(1) : '—',
      'claro',
    )}\n`,
  );
  stdout.write(
    `  mediana por resposta     ${c(`${(mediana(respostas) / 1000).toFixed(1)}s`, 'claro')}` +
      c('   ← a medida de cansaço que interessa', 'apagado') +
      '\n',
  );
  stdout.write(
    `  «não sei»                ${c(String(naoSei), 'claro')}` +
      c(
        `  (${((naoSei / Math.max(comparacoes, 1)) * 100).toFixed(0)}% das comparações)`,
        'apagado',
      ) +
      '\n',
  );
  stdout.write(
    `  renumerações             ${c(String(registo.filter((r) => r.renumerou).length), 'claro')}\n\n`,
  );

  const excedeu = registo.filter((r) => r.comparacoes > 5);
  stdout.write(
    excedeu.length === 0
      ? c('  nenhum título passou das 5 comparações.\n\n', 'medio')
      : c(`  ${excedeu.length} títulos passaram das 5 — isto é um bug.\n\n`, 'brasa'),
  );

  mostrarRanking(ambito);

  const distribuicao = {};
  for (const r of registo)
    distribuicao[r.comparacoes] = (distribuicao[r.comparacoes] ?? 0) + 1;
  stdout.write(c('  comparações por título\n', 'apagado'));
  for (const n of Object.keys(distribuicao).sort()) {
    stdout.write(
      `  ${c(n, 'fraco')}  ${c('▉'.repeat(distribuicao[n]), 'brasa')} ${c(String(distribuicao[n]), 'apagado')}\n`,
    );
  }

  writeFileSync(
    '.aceitacao.json',
    JSON.stringify(
      {
        quando: new Date().toISOString(),
        alvo: ALVO,
        total,
        decorridoMs: decorrido,
        comparacoes,
        naoSei,
        medianaRespostaMs: mediana(respostas),
        registo,
        ranking: notas(ambito)
          .sort((a, b) => a.posicao - b.posicao)
          .map((n) => ({
            titulo: titulos.get(n.subjectId),
            nota: n.nota,
            balde: n.balde,
          })),
      },
      null,
      2,
    ),
  );
  stdout.write(c('\n  gravado em .aceitacao.json\n\n', 'apagado'));
}

main().catch((e) => {
  stdin.setRawMode?.(false);
  stdout.write(`\n${e.stack}\n`);
  process.exit(1);
});

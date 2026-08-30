#!/usr/bin/env node
/**
 * F3-10 · Sessões simuladas contra o motor de ranking.
 *
 * A caixa do plano pede 30 títulos avaliados à mão «sem irritação». Isto NÃO
 * substitui esse teste: nenhum script se irrita, e a paciência de uma pessoa
 * não se mede em ficheiros. O que este script mede é a outra metade — se o
 * algoritmo aguenta o volume que uma pessoa nunca teria paciência para dar.
 *
 * Corre o motor verdadeiro (`avaliar`, `responderA`, `notas`). O único bocado
 * substituído é a pessoa: cada título tem uma qualidade oculta, e o oráculo
 * responde comparando-as. Com ruído — quanto mais próximos os títulos, maior a
 * probabilidade de responder ao contrário, que é o que as pessoas fazem — e com
 * «não sei» quando são indistinguíveis.
 *
 * Mede quatro coisas, e as três últimas são invisíveis numa sessão à mão:
 *
 *   1. Comparações por título, e se o tecto de 5 alguma vez é ultrapassado.
 *   2. Fidelidade da ordem final à ordem verdadeira (tau de Kendall), que é o
 *      preço real do tecto rígido: 5 perguntas não chegam para ordenar 200.
 *   3. Agitação — quantas notas já dadas mudam quando entra um título novo. É
 *      a queixa que ninguém consegue articular: «a nota do meu filme mudou
 *      sozinha».
 *   4. Renumerações de âmbito.
 *
 * Uso:
 *   npm run simular                      30 títulos, 200 sessões
 *   npm run simular -- --titulos 500     uma sessão longa
 *   npm run simular -- --ruido 0         um avaliador perfeitamente coerente
 */

import { avaliar, notas, responderA } from '../src/ranking/motor.ts';
import { LIMITE_COMPARACOES } from '../src/ranking/limites.ts';
import { BALDE_CHEIO } from '../src/ranking/baldes.ts';

// ── Argumentos ───────────────────────────────────────────────────────────────

function arg(nome, omissao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? omissao : Number(process.argv[i + 1]);
}

const TITULOS = arg('titulos', 30);
const SESSOES = arg('sessoes', TITULOS > 100 ? 20 : 200);
// Margem de qualidade abaixo da qual a pessoa começa a hesitar. 0 = oráculo
// perfeito, para separar erro do algoritmo de erro do avaliador.
const RUIDO = arg('ruido', 0.15);
const SEMENTE = arg('semente', 1);

// ── Aleatoriedade determinista ───────────────────────────────────────────────
// Mesma semente, mesmo resultado. Uma regressão neste script tem de ser
// reproduzível, senão é folclore.

function gerador(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── O avaliador simulado ─────────────────────────────────────────────────────

/**
 * A distribuição dos baldes não é uniforme, e isso não é um detalhe: a corrida
 * à mão deu 5 «adorei», 2 «gostei», 0 «nah». As pessoas avaliam o que gostaram.
 * O balde «adorei» enche muito mais depressa do que os outros, e é lá que o
 * algoritmo sofre primeiro. Simular baldes equilibrados seria simular outra app.
 */
function baldeDe(q) {
  if (q > 0.55) return 'adorei';
  if (q > 0.18) return 'gostei';
  return 'nah';
}

function catalogo(rnd, n) {
  return Array.from({ length: n }, (_, i) => {
    // Qualidade enviesada para cima, pela mesma razão que os baldes.
    const q = Math.pow(rnd(), 0.6);
    return { subjectId: `t${String(i).padStart(4, '0')}`, q, balde: baldeDe(q) };
  });
}

/**
 * Responde a uma comparação. `novo` = o título a avaliar é melhor.
 *
 * Perto de zero de diferença a resposta é uma moeda ao ar, como numa pessoa.
 * A certeza cresce linearmente até `RUIDO`, e a partir daí é total.
 */
function responderOraculo(rnd, qNovo, qOutro) {
  const delta = qNovo - qOutro;
  const magnitude = Math.abs(delta);

  if (RUIDO > 0 && magnitude < RUIDO * 0.15) return 'nao-sei';

  const certeza = RUIDO === 0 ? 1 : Math.min(1, magnitude / RUIDO);
  const acerta = rnd() < 0.5 + 0.5 * certeza;
  const melhor = delta > 0;
  return acerta === melhor ? 'novo' : 'existente';
}

// ── Uma sessão ───────────────────────────────────────────────────────────────

function sessao(semente) {
  const rnd = gerador(semente);
  const filmes = catalogo(rnd, TITULOS);
  const q = new Map(filmes.map((f) => [f.subjectId, f.q]));

  let ambito = [];
  const comparacoesPorTitulo = [];
  let naoSei = 0;
  let renumeracoes = 0;
  let excedeuTecto = 0;

  // Agitação: notas que mudam quando entra um título novo.
  let mexidas = 0;
  let mexidasPossiveis = 0;
  let desvioTotal = 0;
  let desvioMaximo = 0;
  let mexidasEmBaldeCheio = 0;
  let desvioMaximoCheio = 0;

  for (const filme of filmes) {
    const antes = new Map(notas(ambito).map((x) => [x.subjectId, x.nota]));

    let passo = avaliar(ambito, filme.subjectId, filme.balde);
    while (passo.tipo === 'pergunta') {
      const resposta = responderOraculo(rnd, filme.q, q.get(passo.contra));
      if (resposta === 'nao-sei') naoSei += 1;
      passo = responderA(ambito, passo.avaliacao, resposta);
    }

    ambito = passo.ambito;
    comparacoesPorTitulo.push(passo.comparacoes);
    if (passo.comparacoes > LIMITE_COMPARACOES) excedeuTecto += 1;
    if (passo.renumerou) renumeracoes += 1;

    // Quantos títulos tem cada balde depois desta inserção. Serve para separar
    // as notas que mexem porque o balde ainda se está a abrir (decisão D1, até
    // BALDE_CHEIO) das que mexem por reordenação, que é o caso preocupante.
    const tamanhoDoBalde = new Map();
    for (const e of ambito) {
      tamanhoDoBalde.set(e.balde, (tamanhoDoBalde.get(e.balde) ?? 0) + 1);
    }

    for (const depois of notas(ambito)) {
      const anterior = antes.get(depois.subjectId);
      if (anterior === undefined) continue; // é o título que acabou de entrar
      mexidasPossiveis += 1;
      const d = Math.abs(depois.nota - anterior);
      if (d > 0) {
        mexidas += 1;
        desvioTotal += d;
        if (d > desvioMaximo) desvioMaximo = d;
        if (tamanhoDoBalde.get(depois.balde) > BALDE_CHEIO) {
          mexidasEmBaldeCheio += 1;
          if (d > desvioMaximoCheio) desvioMaximoCheio = d;
        }
      }
    }
  }

  return {
    comparacoesPorTitulo,
    naoSei,
    renumeracoes,
    excedeuTecto,
    mexidas,
    mexidasPossiveis,
    desvioTotal,
    desvioMaximo,
    mexidasEmBaldeCheio,
    desvioMaximoCheio,
    tau: tauPorBalde(ambito, q),
  };
}

/**
 * Tau de Kendall entre a ordem produzida e a ordem verdadeira, dentro de cada
 * balde — que é onde a ordem conta para a nota. 1 = ordem perfeita, 0 = ordem
 * aleatória, negativo = ao contrário.
 */
function tauPorBalde(ambito, q) {
  let concordantes = 0;
  let discordantes = 0;

  for (const balde of ['adorei', 'gostei', 'nah']) {
    const membros = ambito
      .filter((e) => e.balde === balde)
      .sort((a, b) => a.posicao - b.posicao);

    for (let i = 0; i < membros.length; i += 1) {
      for (let j = i + 1; j < membros.length; j += 1) {
        // i está acima de j no ranking. Devia ter qualidade maior.
        const d = q.get(membros[i].subjectId) - q.get(membros[j].subjectId);
        if (d > 0) concordantes += 1;
        else if (d < 0) discordantes += 1;
      }
    }
  }

  const total = concordantes + discordantes;
  return total === 0 ? 1 : (concordantes - discordantes) / total;
}

// ── Estatística ──────────────────────────────────────────────────────────────

const media = (l) => l.reduce((s, x) => s + x, 0) / l.length;

function percentil(l, p) {
  const ordenada = [...l].sort((a, b) => a - b);
  return ordenada[Math.min(ordenada.length - 1, Math.floor((p / 100) * ordenada.length))];
}

// ── Corrida ──────────────────────────────────────────────────────────────────

const corridas = Array.from({ length: SESSOES }, (_, i) => sessao(SEMENTE + i * 7919));

const todasComparacoes = corridas.flatMap((c) => c.comparacoesPorTitulo);
const excedeu = corridas.reduce((s, c) => s + c.excedeuTecto, 0);
const taus = corridas.map((c) => c.tau);
const mexidas = corridas.reduce((s, c) => s + c.mexidas, 0);
const mexidasPossiveis = corridas.reduce((s, c) => s + c.mexidasPossiveis, 0);
const desvioTotal = corridas.reduce((s, c) => s + c.desvioTotal, 0);
const desvioMaximo = Math.max(...corridas.map((c) => c.desvioMaximo));
const mexidasEmBaldeCheio = corridas.reduce((s, c) => s + c.mexidasEmBaldeCheio, 0);
const desvioMaximoCheio = Math.max(...corridas.map((c) => c.desvioMaximoCheio));
const naoSei = corridas.reduce((s, c) => s + c.naoSei, 0);
const renumeracoes = corridas.reduce((s, c) => s + c.renumeracoes, 0);

const n = (x, casas = 2) => x.toFixed(casas);

process.stdout.write(
  `\n${SESSOES} sessões de ${TITULOS} títulos · ruído ${RUIDO} · semente ${SEMENTE}\n` +
    `${'─'.repeat(64)}\n\n`,
);

process.stdout.write('comparações por título\n');
process.stdout.write(
  `  média ${n(media(todasComparacoes))}   mediana ${percentil(todasComparacoes, 50)}` +
    `   p95 ${percentil(todasComparacoes, 95)}   máximo ${Math.max(...todasComparacoes)}\n`,
);
process.stdout.write(
  `  acima do tecto de ${LIMITE_COMPARACOES}: ${excedeu}` +
    (excedeu === 0 ? '  (o tecto aguenta)\n' : '  ← O TECTO FOI FURADO\n'),
);
// «não sei» aborta a sequência sem contar como comparação, portanto o total de
// perguntas feitas é a soma das comparações mais os «não sei».
const perguntas = todasComparacoes.reduce((s, x) => s + x, 0) + naoSei;
process.stdout.write(
  `  «não sei»: ${naoSei} em ${perguntas} perguntas` +
    `  (${n((100 * naoSei) / Math.max(1, perguntas), 1)}%)\n\n`,
);

// Como a carga cresce ao longo da sessão. É isto que uma pessoa sente: as
// primeiras são de graça, as últimas é que custam.
const FATIAS = 5;
process.stdout.write('custo ao longo da sessão (média de comparações)\n  ');
for (let d = 0; d < FATIAS; d += 1) {
  const de = Math.floor((d * TITULOS) / FATIAS);
  const ate = Math.floor(((d + 1) * TITULOS) / FATIAS);
  const fatia = corridas.flatMap((c) => c.comparacoesPorTitulo.slice(de, ate));
  process.stdout.write(`${de + 1}-${ate}: ${n(media(fatia), 1)}   `);
}
process.stdout.write('\n\n');

process.stdout.write('fidelidade da ordem final (tau de Kendall, dentro do balde)\n');
process.stdout.write(
  `  média ${n(media(taus), 3)}   pior sessão ${n(Math.min(...taus), 3)}\n\n`,
);

process.stdout.write('agitação — notas já dadas que mudam quando entra um título\n');
process.stdout.write(
  `  ${n((100 * mexidas) / Math.max(1, mexidasPossiveis), 1)}% mudam` +
    `   desvio médio ${n(desvioTotal / Math.max(1, mexidas), 2)}` +
    `   pior ${n(desvioMaximo, 1)}\n`,
);
process.stdout.write(
  `  das quais em baldes já cheios (>${BALDE_CHEIO}): ${mexidasEmBaldeCheio}` +
    `   pior ${n(desvioMaximoCheio, 1)}\n`,
);
process.stdout.write(
  `  renumerações de âmbito: ${renumeracoes} em ${SESSOES} sessões\n\n`,
);

// Falha o processo se o tecto for furado. É a única propriedade aqui que é uma
// promessa e não uma medição.
process.exit(excedeu > 0 ? 1 : 0);

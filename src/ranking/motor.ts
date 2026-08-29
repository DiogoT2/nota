/**
 * O motor. Junta baldes, comparações, posições e derivação numa superfície
 * pequena, e é o único sítio onde as regras se combinam.
 *
 * Continua sem React, sem rede e sem Supabase. Recebe o estado de um âmbito,
 * devolve o estado seguinte. Quem grava é a camada de dados, na Fase 5.
 */

import { type Balde } from './baldes.ts';
import {
  comecar,
  responder,
  type Estado,
  type Resposta,
  type Sequencia,
} from './comparar.ts';
import { derivarAmbito, type ComNota } from './derivar.ts';
import { inserir, mover, type Item } from './posicoes.ts';
import type { Entrada } from './ambitos.ts';

/** O que se está a avaliar, e onde já se chegou na sequência. */
export type Avaliacao = {
  readonly subjectId: string;
  readonly balde: Balde;
  readonly sequencia: Sequencia;
};

export type Passo =
  | {
      readonly tipo: 'pergunta';
      readonly avaliacao: Avaliacao;
      readonly contra: string;
      readonly numero: number;
      readonly maximoRestante: number;
    }
  | {
      readonly tipo: 'pronto';
      readonly ambito: readonly Entrada[];
      readonly comparacoes: number;
      readonly renumerou: boolean;
    };

const ordenar = (ambito: readonly Entrada[]): readonly Entrada[] =>
  [...ambito].sort((a, b) => a.posicao - b.posicao);

/** Só os títulos do mesmo balde, do melhor para o pior. */
function doBalde(ambito: readonly Entrada[], balde: Balde): readonly Entrada[] {
  return ordenar(ambito).filter((e) => e.balde === balde);
}

/**
 * Traduz um índice dentro do balde para um índice no âmbito inteiro.
 *
 * Os baldes ocupam faixas contíguas do âmbito — todos os «adorei» antes de
 * todos os «gostei», e assim por baixo. Colocar o 2.º «gostei» significa
 * colocar depois de todos os «adorei» e depois do 1.º «gostei».
 */
function indiceNoAmbito(
  ambito: readonly Entrada[],
  balde: Balde,
  indiceNoBalde: number,
): number {
  const ordenado = ordenar(ambito);
  const membros = ordenado.filter((e) => e.balde === balde);

  if (membros.length === 0) {
    // Balde vazio: entra logo a seguir a todos os baldes melhores. Sem isto, um
    // balde novo nasceria no fim do âmbito, abaixo de baldes piores.
    const melhores = ordenado.filter((e) => ordemDeBalde(e.balde) > ordemDeBalde(balde));
    return melhores.length;
  }

  if (indiceNoBalde >= membros.length) {
    return ordenado.indexOf(membros[membros.length - 1]!) + 1;
  }
  return ordenado.indexOf(membros[indiceNoBalde]!);
}

function ordemDeBalde(b: Balde): number {
  return b === 'adorei' ? 2 : b === 'gostei' ? 1 : 0;
}

/**
 * Começa a avaliar um título.
 *
 * O primeiro título de um balde não gera comparação nenhuma — não há com quem
 * comparar, e perguntar seria teatro.
 *
 * Títulos pregados não entram na comparação: foram postos à mão e nenhuma
 * pergunta os deve mover (decisão D2). Ficam onde estão; o título novo é
 * colocado à volta deles.
 */
export function avaliar(
  ambito: readonly Entrada[],
  subjectId: string,
  balde: Balde,
): Passo {
  // Reavaliar é avaliar de novo: o título sai do âmbito e volta a entrar pelo
  // fluxo normal. É o que a caixa «reavaliação reinicia o fluxo» pede.
  const semEle = ambito.filter((e) => e.subjectId !== subjectId);
  const comparaveis = doBalde(semEle, balde).filter((e) => !e.pregado);

  const estado = comecar(comparaveis.map((e) => e.subjectId));
  return aplicar(
    semEle,
    { subjectId, balde, sequencia: sequenciaDe(estado, comparaveis) },
    estado,
  );
}

function sequenciaDe(estado: Estado, comparaveis: readonly Entrada[]): Sequencia {
  return estado.tipo === 'pergunta'
    ? estado.sequencia
    : { balde: comparaveis.map((e) => e.subjectId), baixo: 0, alto: 0, feitas: 0 };
}

/** Responde à pergunta corrente e avança. */
export function responderA(
  ambito: readonly Entrada[],
  avaliacao: Avaliacao,
  resposta: Resposta,
): Passo {
  const semEle = ambito.filter((e) => e.subjectId !== avaliacao.subjectId);
  return aplicar(semEle, avaliacao, responder(avaliacao.sequencia, resposta));
}

function aplicar(
  ambito: readonly Entrada[],
  avaliacao: Avaliacao,
  estado: Estado,
): Passo {
  if (estado.tipo === 'pergunta') {
    return {
      tipo: 'pergunta',
      avaliacao: { ...avaliacao, sequencia: estado.sequencia },
      contra: estado.pergunta.contra,
      numero: estado.pergunta.numero,
      maximoRestante: estado.pergunta.maximoRestante,
    };
  }

  // A sequência decidiu um índice entre os COMPARÁVEIS. Traduzi-lo para um
  // índice entre todos os membros do balde exige recontar os pregados que
  // ficaram pelo caminho — eles ocupam lugar mesmo não sendo comparados.
  const membros = doBalde(ambito, avaliacao.balde);
  const indiceNoBalde = indiceEntreMembros(
    membros,
    avaliacao.sequencia.balde,
    estado.indice,
  );
  const indice = indiceNoAmbito(ambito, avaliacao.balde, indiceNoBalde);

  const lista: readonly Item[] = ordenar(ambito).map((e) => ({
    subjectId: e.subjectId,
    posicao: e.posicao,
  }));
  const { lista: nova, renumerou } = inserir(lista, avaliacao.subjectId, indice);

  const porId = new Map(ambito.map((e) => [e.subjectId, e]));
  return {
    tipo: 'pronto',
    comparacoes: estado.comparacoes,
    renumerou,
    ambito: nova.map((item) => {
      const antes = porId.get(item.subjectId);
      return antes === undefined
        ? {
            subjectId: item.subjectId,
            balde: avaliacao.balde,
            posicao: item.posicao,
            pregado: false,
          }
        : { ...antes, posicao: item.posicao };
    }),
  };
}

/**
 * Converte um índice na lista de comparáveis para um índice na lista completa
 * do balde, que inclui os pregados.
 */
function indiceEntreMembros(
  membros: readonly Entrada[],
  comparaveis: readonly string[],
  indiceNosComparaveis: number,
): number {
  if (indiceNosComparaveis >= comparaveis.length) return membros.length;
  const alvo = comparaveis[indiceNosComparaveis]!;
  const i = membros.findIndex((e) => e.subjectId === alvo);
  return i === -1 ? membros.length : i;
}

/**
 * Arrastar à mão. Prega o título: nenhuma comparação futura o move sozinho.
 * Só outro arrasto o desprega e volta a pregar noutro sítio (decisão D2).
 */
export function arrastar(
  ambito: readonly Entrada[],
  subjectId: string,
  paraIndice: number,
): { readonly ambito: readonly Entrada[]; readonly renumerou: boolean } {
  const ordenado = ordenar(ambito);
  const lista: readonly Item[] = ordenado.map((e) => ({
    subjectId: e.subjectId,
    posicao: e.posicao,
  }));
  const { lista: nova, renumerou } = mover(lista, subjectId, paraIndice);

  const porId = new Map(ambito.map((e) => [e.subjectId, e]));
  return {
    renumerou,
    ambito: nova.map((item) => ({
      ...porId.get(item.subjectId)!,
      posicao: item.posicao,
      pregado: item.subjectId === subjectId ? true : porId.get(item.subjectId)!.pregado,
    })),
  };
}

/** As notas de um âmbito. É o que a UI mostra e o que a vista `scores` calcula. */
export function notas(ambito: readonly Entrada[]): readonly ComNota[] {
  return derivarAmbito(
    ordenar(ambito).map((e) => ({
      subjectId: e.subjectId,
      balde: e.balde,
      posicao: e.posicao,
    })),
  );
}

/**
 * F3-3 · Inserção binária com um tecto rígido de comparações.
 *
 * A sequência é uma máquina de estados pura: recebe uma resposta, devolve o
 * estado seguinte. Não sabe o que é um ecrã, uma rede ou uma base de dados —
 * é isso que permite o fuzz de 1000 inserções correr em milissegundos e é
 * requisito do PLAN.md («zero dependências de React, rede ou Supabase»).
 *
 * ── O tecto ──
 *
 * Cinco comparações colocam com exactidão entre até 31 títulos (2^5 - 1). Acima
 * disso, as cinco estreitam a janela o mais que podem e o título entra no meio
 * do que sobrar. O tecto é rígido: **nunca há uma sexta pergunta**, seja qual
 * for o tamanho do balde. É a diferença entre avaliar um filme e preencher um
 * inquérito.
 *
 * ── «Não sei» ──
 *
 * Não é uma resposta errada, é a ausência de resposta. Aborta a sequência e
 * insere no ponto médio da janela corrente — o que já se sabe é respeitado, o
 * que não se sabe não é inventado.
 */

import { LIMITE_COMPARACOES } from './limites.ts';

export type Resposta = 'novo' | 'existente' | 'nao-sei';

/** Um par a mostrar. `contra` é o título já colocado com que se compara. */
export type Pergunta = {
  readonly contra: string;
  /** Quantas já foram feitas, incluindo esta. Para a barra de progresso. */
  readonly numero: number;
  /** Quantas ainda podem vir, no máximo. Nunca mente para mais. */
  readonly maximoRestante: number;
};

export type Sequencia = {
  /** Ordenado do melhor para o pior. Só os títulos do mesmo balde. */
  readonly balde: readonly string[];
  /** Janela onde o novo título ainda pode entrar: [baixo, alto). */
  readonly baixo: number;
  readonly alto: number;
  readonly feitas: number;
};

export type Estado =
  | {
      readonly tipo: 'pergunta';
      readonly pergunta: Pergunta;
      readonly sequencia: Sequencia;
    }
  | { readonly tipo: 'colocado'; readonly indice: number; readonly comparacoes: number };

/**
 * Quantas comparações faltam para colocar com exactidão numa janela de `n`.
 * `ceil(log2(n+1))`, sem passar pelo vírgula flutuante.
 */
export function comparacoesNecessarias(n: number): number {
  let precisas = 0;
  let alcance = 1;
  while (alcance <= n) {
    alcance *= 2;
    precisas += 1;
  }
  return precisas;
}

function proximo(s: Sequencia): Estado {
  const largura = s.alto - s.baixo;

  // Janela de largura 1: já se sabe onde entra. Zero perguntas para o primeiro
  // título de um balde, que é o caso da lista vazia.
  if (largura <= 0) {
    return { tipo: 'colocado', indice: s.baixo, comparacoes: s.feitas };
  }

  if (s.feitas >= LIMITE_COMPARACOES) {
    // Acabaram as perguntas e a janela ainda é larga. Entra no meio do que
    // sobrou: é o palpite menos mau, e é o mesmo que o «não sei» faz.
    return {
      tipo: 'colocado',
      indice: s.baixo + Math.floor(largura / 2),
      comparacoes: s.feitas,
    };
  }

  const meio = s.baixo + Math.floor(largura / 2);
  const restantes = Math.min(
    LIMITE_COMPARACOES - s.feitas,
    comparacoesNecessarias(largura),
  );

  return {
    tipo: 'pergunta',
    pergunta: {
      contra: s.balde[meio]!,
      numero: s.feitas + 1,
      maximoRestante: restantes,
    },
    sequencia: s,
  };
}

/** Começa a sequência para colocar um título dentro do seu balde. */
export function comecar(balde: readonly string[]): Estado {
  return proximo({ balde, baixo: 0, alto: balde.length, feitas: 0 });
}

/**
 * Responde à pergunta corrente.
 *
 * `novo` — o título a avaliar é melhor do que aquele com que foi comparado.
 * `existente` — o outro é melhor.
 * `nao-sei` — aborta e coloca no meio da janela corrente.
 */
export function responder(s: Sequencia, resposta: Resposta): Estado {
  const largura = s.alto - s.baixo;
  const meio = s.baixo + Math.floor(largura / 2);

  if (resposta === 'nao-sei') {
    return { tipo: 'colocado', indice: meio, comparacoes: s.feitas };
  }

  // A lista está ordenada do melhor para o pior. Ser melhor significa entrar
  // mais acima, portanto a janela fecha-se pela parte de baixo.
  const seguinte: Sequencia =
    resposta === 'novo'
      ? { ...s, alto: meio, feitas: s.feitas + 1 }
      : { ...s, baixo: meio + 1, feitas: s.feitas + 1 };

  return proximo(seguinte);
}

/**
 * Corre a sequência inteira com um oráculo. Serve os testes de propriedades e
 * o fuzz, e documenta a máquina de estados melhor do que qualquer descrição.
 */
export function colocarCom(
  balde: readonly string[],
  responderA: (contra: string) => Resposta,
): {
  readonly indice: number;
  readonly comparacoes: number;
  readonly perguntas: readonly string[];
} {
  const perguntas: string[] = [];
  let estado = comecar(balde);

  while (estado.tipo === 'pergunta') {
    perguntas.push(estado.pergunta.contra);
    estado = responder(estado.sequencia, responderA(estado.pergunta.contra));
  }

  return { indice: estado.indice, comparacoes: estado.comparacoes, perguntas };
}

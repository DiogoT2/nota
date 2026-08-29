/**
 * F3-4 · Posições esparsas.
 *
 * O espelho em TypeScript do que a Fase 1 fez em SQL: inteiros com passo 1024,
 * inserção no ponto médio, e renumeração do âmbito quando o espaço entre dois
 * vizinhos se esgota.
 *
 * A alternativa — posição fraccionária — foi rejeitada na Fase 1 e a razão
 * mantém-se: a precisão do vírgula flutuante degrada-se em silêncio ao fim de
 * ~50 inserções no mesmo intervalo, e o modo de falha é um empate que corrompe
 * a ordem sem dar erro. Com inteiros, o modo de falha é explícito: não há
 * espaço, renumera-se.
 */

export const PASSO = 1024;

export type Item = { readonly subjectId: string; readonly posicao: number };

/** Precisa de renumeração para caber alguma coisa entre `a` e `b`? */
export function semEspaco(a: number, b: number): boolean {
  return b - a <= 1;
}

/**
 * A posição para inserir no índice `indice` de uma lista ordenada.
 *
 * `indice` 0 é antes de tudo; `lista.length` é depois de tudo. Devolve `null`
 * quando não há espaço — quem chama tem de renumerar e voltar a perguntar.
 */
export function posicaoPara(lista: readonly Item[], indice: number): number | null {
  if (indice < 0 || indice > lista.length) {
    throw new RangeError(`índice ${indice} fora de uma lista de ${lista.length}`);
  }

  if (lista.length === 0) return PASSO;

  // No topo: metade da posição do primeiro. Se o primeiro estiver em 1, não há
  // metade inteira possível.
  if (indice === 0) {
    const primeiro = lista[0]!.posicao;
    return primeiro <= 1 ? null : Math.floor(primeiro / 2);
  }

  // No fim: mais um passo. Não falha nunca — não há tecto prático num bigint
  // de Postgres, e um ranking pessoal não chega lá.
  if (indice === lista.length) return lista[lista.length - 1]!.posicao + PASSO;

  const a = lista[indice - 1]!.posicao;
  const b = lista[indice]!.posicao;
  return semEspaco(a, b) ? null : Math.floor((a + b) / 2);
}

/** Renumera o âmbito inteiro para 1024, 2048, … mantendo a ordem. */
export function renumerar(lista: readonly Item[]): readonly Item[] {
  return [...lista]
    .sort((x, y) => x.posicao - y.posicao)
    .map((item, i) => ({ ...item, posicao: (i + 1) * PASSO }));
}

export type Insercao = {
  readonly lista: readonly Item[];
  /** Renumerou-se para caber? Quem grava precisa de saber: uma renumeração
   *  reescreve o âmbito inteiro, uma inserção normal escreve uma linha. */
  readonly renumerou: boolean;
};

/**
 * Insere um título no índice pedido, renumerando se for preciso.
 *
 * Esta função é a única forma correcta de inserir. `posicaoPara` sozinha
 * devolve `null` quando não há espaço, e ignorar esse `null` é como se
 * corrompem rankings.
 */
export function inserir(
  lista: readonly Item[],
  subjectId: string,
  indice: number,
): Insercao {
  let base = lista;
  let renumerou = false;

  let posicao = posicaoPara(base, indice);
  if (posicao === null) {
    base = renumerar(base);
    renumerou = true;
    posicao = posicaoPara(base, indice);
    // Depois de renumerar há 1023 lugares entre vizinhos. Se ainda assim não
    // houver espaço, o problema não é o espaço — é um erro de programação, e
    // falhar alto é melhor do que inventar uma posição.
    if (posicao === null) {
      throw new Error('sem espaço mesmo depois de renumerar: índice inválido?');
    }
  }

  const nova = [...base];
  nova.splice(indice, 0, { subjectId, posicao });
  return { lista: nova, renumerou };
}

/** Move um título já colocado para outro índice. É o arrasto manual. */
export function mover(
  lista: readonly Item[],
  subjectId: string,
  paraIndice: number,
): Insercao {
  const de = lista.findIndex((i) => i.subjectId === subjectId);
  if (de === -1) throw new Error(`${subjectId} não está neste âmbito`);

  const sem = lista.filter((i) => i.subjectId !== subjectId);
  // Retirar um item antes do destino desloca o destino um lugar para trás.
  const destino = paraIndice > de ? paraIndice - 1 : paraIndice;
  return inserir(sem, subjectId, Math.max(0, Math.min(destino, sem.length)));
}

/** A lista está coerente? Usado nos testes de fuzz e como asserção barata. */
export function coerente(lista: readonly Item[]): boolean {
  const posicoes = lista.map((i) => i.posicao);
  const ordenada = posicoes.every((p, i) => i === 0 || posicoes[i - 1]! < p);
  const unicas = new Set(posicoes).size === posicoes.length;
  const positivas = posicoes.every((p) => Number.isInteger(p) && p > 0);
  const idsUnicos = new Set(lista.map((i) => i.subjectId)).size === lista.length;
  return ordenada && unicas && positivas && idsUnicos;
}

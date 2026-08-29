/**
 * F3-2 · A derivação da nota.
 *
 * A nota nunca é escrita. Sai de duas coisas: o balde, que dá o intervalo, e a
 * posição dentro do balde, que dá o sítio dentro do intervalo.
 *
 * ── Decisão D1: as notas abrem-se devagar ──
 *
 * Num balde com poucos títulos as notas ficam comprimidas ao centro e vão
 * abrindo à medida que o balde enche, até aos 5 títulos.
 *
 *   1 título    9.0
 *   2 títulos   9.3  8.8
 *   3 títulos   9.5  9.0  8.5
 *   4 títulos   9.8  9.3  8.8  8.3
 *   5+          10.0 9.5  9.0  8.5  8.0
 *
 * A alternativa — espalhar sempre por todo o intervalo — faria o primeiro
 * «adorei» saltar de 9.0 para 10.0 assim que entrasse o segundo. Os saltos
 * maiores dar-se-iam nos primeiros títulos, que é quando toda a gente está.
 *
 * E dá significado ao topo: um 10.0 quer dizer que ganhou a pelo menos quatro.
 *
 * ATENÇÃO: esta mesma regra existe em SQL, na vista `scores`, porque é de lá
 * que o cliente lê. As duas implementações são comparadas por um teste com os
 * mesmos dados. Sem esse teste, divergiam — é só uma questão de tempo.
 */

import { BALDE_CHEIO, INTERVALO, type Balde } from './baldes.ts';

/** Uma casa decimal, sempre. Uma nota nunca se mostra de outra forma. */
export function arredondar(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Quanto do intervalo é usado, entre 0 e 1.
 *
 * Zero com um título — fica no centro. Um a partir de `BALDE_CHEIO` — usa o
 * intervalo todo.
 */
export function amplitude(noBalde: number): number {
  if (noBalde <= 1) return 0;
  return Math.min(1, (noBalde - 1) / (BALDE_CHEIO - 1));
}

/**
 * A nota de um título.
 *
 * @param balde  o balde escolhido pela pessoa
 * @param lugar  posição dentro do balde, 1 = o melhor
 * @param noBalde quantos títulos o balde tem
 */
export function derivar(balde: Balde, lugar: number, noBalde: number): number {
  const { base, topo } = INTERVALO[balde];

  if (noBalde <= 0 || lugar < 1 || lugar > noBalde) {
    throw new RangeError(`lugar ${lugar} inválido num balde de ${noBalde}`);
  }

  const centro = (base + topo) / 2;
  if (noBalde === 1) return arredondar(centro);

  const meia = ((topo - base) / 2) * amplitude(noBalde);
  // `lugar` 1 fica no topo da amplitude, `noBalde` na base. A fracção vai de
  // +1 a -1 conforme se desce a lista.
  const fraccao = 1 - (2 * (lugar - 1)) / (noBalde - 1);
  return arredondar(centro + meia * fraccao);
}

/** As notas de um balde inteiro, do melhor para o pior. */
export function derivarBalde(balde: Balde, noBalde: number): readonly number[] {
  return Array.from({ length: noBalde }, (_, i) => derivar(balde, i + 1, noBalde));
}

export type Colocado = {
  readonly subjectId: string;
  readonly balde: Balde;
  /** Posição no âmbito inteiro, não dentro do balde. Menor é melhor. */
  readonly posicao: number;
};

export type ComNota = Colocado & { readonly nota: number };

/**
 * As notas de um âmbito inteiro.
 *
 * O `lugar` de cada título conta-se DENTRO do seu balde, e é por isso que a
 * ordem global tem de ser agrupada primeiro. Um título é o 3.º «adorei» mesmo
 * que seja o 3.º do ranking todo ou o 30.º.
 */
export function derivarAmbito(itens: readonly Colocado[]): readonly ComNota[] {
  const porBalde = new Map<Balde, Colocado[]>();
  for (const item of itens) {
    const lista = porBalde.get(item.balde);
    if (lista === undefined) porBalde.set(item.balde, [item]);
    else lista.push(item);
  }

  const notas = new Map<string, number>();
  for (const [balde, lista] of porBalde) {
    const ordenados = [...lista].sort((a, b) => a.posicao - b.posicao);
    ordenados.forEach((item, i) => {
      notas.set(item.subjectId, derivar(balde, i + 1, ordenados.length));
    });
  }

  return itens.map((item) => ({ ...item, nota: notas.get(item.subjectId)! }));
}

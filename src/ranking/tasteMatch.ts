/**
 * F3-7 · Taste match.
 *
 * Mede o acordo entre duas pessoas sobre os títulos que ambas avaliaram.
 *
 * Decisão D3: abaixo de 10 títulos em comum não se mostra nada — nem a
 * percentagem, nem o número. Com 5 títulos, um deles diferente move a
 * percentagem em dezenas de pontos; um número que salta assim é pior do que
 * número nenhum, porque as pessoas confiam nele à mesma.
 */

import { SOBREPOSICAO_MINIMA } from './limites.ts';

export type Par = {
  readonly subjectId: string;
  readonly minha: number;
  readonly dela: number;
};

export type TasteMatch = {
  readonly sobreposicao: number;
  /** 0 a 1. `null` abaixo do mínimo — não há nada a mostrar. */
  readonly afinidade: number | null;
};

/**
 * A distância média entre as notas, normalizada e invertida.
 *
 * Uma diferença de 10 pontos (0.0 contra 10.0) dá afinidade 0; notas iguais dão
 * 1. É deliberadamente simples: uma medida que ninguém consegue explicar em uma
 * frase não devia aparecer no perfil de ninguém.
 */
export function tasteMatch(pares: readonly Par[]): TasteMatch {
  const sobreposicao = pares.length;
  if (sobreposicao < SOBREPOSICAO_MINIMA) return { sobreposicao, afinidade: null };

  const soma = pares.reduce((t, p) => t + Math.abs(p.minha - p.dela), 0);
  const distanciaMedia = soma / sobreposicao;
  const afinidade = Math.max(0, Math.min(1, 1 - distanciaMedia / 10));

  return { sobreposicao, afinidade: Math.round(afinidade * 1000) / 1000 };
}

/** Os títulos que duas pessoas avaliaram ambas. */
export function emComum(
  minhas: ReadonlyMap<string, number>,
  dela: ReadonlyMap<string, number>,
): readonly Par[] {
  const pares: Par[] = [];
  for (const [subjectId, minha] of minhas) {
    const outra = dela.get(subjectId);
    if (outra !== undefined) pares.push({ subjectId, minha, dela: outra });
  }
  return pares;
}

import { limit } from '@/theme';

export type Derivation = {
  /** Nota do topo do ranking. */
  readonly top: number;
  /** Nota do fundo do ranking. */
  readonly bottom: number;
};

/**
 * Deriva a nota de cada posição a partir da ORDEM. O utilizador nunca escreve
 * um número — regra 4 do produto.
 *
 * Interpolação linear entre `top` e `bottom`, arredondada a uma casa. A
 * monotonia é garantida por construção: `deriveScores(n)[i] >= [i + 1]`, por
 * isso é impossível um #4 ficar acima de um #3.
 *
 * PROVISÓRIO: o motor real (fase 3, `ranking-engineer`) deriva a nota da
 * posição relativa dentro do balde e do histórico de comparações, não de uma
 * recta. A assinatura é a mesma para que os ecrãs não tenham de mudar.
 */
export function deriveScores(count: number, range: Derivation = { top: 9.5, bottom: 7.8 }): readonly number[] {
  if (count <= 0) return [];
  if (count === 1) return [round(range.top)];

  const step = (range.top - range.bottom) / (count - 1);
  const scores: number[] = [];
  let previous = Number.POSITIVE_INFINITY;

  for (let index = 0; index < count; index += 1) {
    const derived = Math.min(round(range.top - step * index), previous);
    scores.push(derived);
    previous = derived;
  }
  return scores;
}

const round = (value: number): number => Math.round(value * 10) / 10;

/**
 * Move um item de `from` para `to` e devolve a nova ordem. Não toca em notas:
 * quem as escreve é sempre {@link deriveScores}, a partir da ordem resultante.
 */
export function reorder<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return items;
  next.splice(to, 0, moved);
  return next;
}

/** Quantas comparações faltam numa sequência de avaliação. */
export function comparisonsRemaining(done: number): number {
  return Math.max(0, limit.comparisons - done);
}

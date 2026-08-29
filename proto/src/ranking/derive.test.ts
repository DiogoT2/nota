import { describe, expect, it } from 'vitest';
import { deriveScores, reorder } from './derive';

describe('deriveScores', () => {
  it('nunca sobe ao descer no ranking', () => {
    const scores = deriveScores(50);
    for (let index = 1; index < scores.length; index += 1) {
      expect(scores[index]!).toBeLessThanOrEqual(scores[index - 1]!);
    }
  });

  it('ancora o topo e o fundo no intervalo pedido', () => {
    const scores = deriveScores(10, { top: 9.5, bottom: 7.8 });
    expect(scores[0]).toBe(9.5);
    expect(scores.at(-1)).toBe(7.8);
  });

  it('trata listas vazias e de um só título', () => {
    expect(deriveScores(0)).toEqual([]);
    expect(deriveScores(1)).toEqual([9.5]);
  });
});

describe('reorder', () => {
  it('move um item sem perder nenhum', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('devolve a lista intacta para índices inválidos', () => {
    const items = ['a', 'b'];
    expect(reorder(items, 0, 0)).toBe(items);
    expect(reorder(items, 5, 0)).toBe(items);
  });
});

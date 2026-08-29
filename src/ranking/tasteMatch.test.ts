import { describe, expect, it } from 'vitest';
import { SOBREPOSICAO_MINIMA } from './limites.ts';
import { emComum, tasteMatch } from './tasteMatch.ts';

const pares = (n: number, delta = 0) =>
  Array.from({ length: n }, (_, i) => ({
    subjectId: `t${i}`,
    minha: 7,
    dela: 7 + delta,
  }));

describe('taste match', () => {
  it('não mostra nada abaixo do mínimo (decisão D3)', () => {
    for (let n = 0; n < SOBREPOSICAO_MINIMA; n += 1) {
      const r = tasteMatch(pares(n));
      expect(r.afinidade).toBeNull();
      expect(r.sobreposicao).toBe(n);
    }
  });

  it('aparece exactamente no mínimo, e não antes', () => {
    expect(tasteMatch(pares(SOBREPOSICAO_MINIMA - 1)).afinidade).toBeNull();
    expect(tasteMatch(pares(SOBREPOSICAO_MINIMA)).afinidade).not.toBeNull();
  });

  it('notas iguais dão afinidade máxima', () => {
    expect(tasteMatch(pares(10, 0)).afinidade).toBe(1);
  });

  it('o extremo oposto dá zero', () => {
    const opostos = Array.from({ length: 10 }, (_, i) => ({
      subjectId: `t${i}`,
      minha: 0,
      dela: 10,
    }));
    expect(tasteMatch(opostos).afinidade).toBe(0);
  });

  it('a afinidade desce à medida que as notas se afastam', () => {
    const anteriores = [0, 1, 2, 3, 4].map((d) => tasteMatch(pares(10, d)).afinidade!);
    for (let i = 1; i < anteriores.length; i += 1) {
      expect(anteriores[i]!).toBeLessThan(anteriores[i - 1]!);
    }
  });

  it('fica sempre entre 0 e 1', () => {
    for (const d of [-10, -5, 0, 5, 10]) {
      const a = tasteMatch(pares(12, d)).afinidade!;
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});

describe('títulos em comum', () => {
  it('só conta os que as duas avaliaram', () => {
    const minhas = new Map([
      ['a', 8],
      ['b', 6],
      ['c', 9],
    ]);
    const dela = new Map([
      ['b', 7],
      ['c', 9],
      ['d', 4],
    ]);
    const comuns = emComum(minhas, dela);
    expect(comuns.map((p) => p.subjectId).sort()).toEqual(['b', 'c']);
  });

  it('sem sobreposição não há nada a medir', () => {
    const r = tasteMatch(emComum(new Map([['a', 8]]), new Map([['b', 8]])));
    expect(r.sobreposicao).toBe(0);
    expect(r.afinidade).toBeNull();
  });
});

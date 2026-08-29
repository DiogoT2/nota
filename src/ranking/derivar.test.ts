import { describe, expect, it } from 'vitest';
import { BALDES, INTERVALO, type Balde } from './baldes.ts';
import { amplitude, derivar, derivarAmbito, derivarBalde } from './derivar.ts';

describe('as notas abrem-se devagar (decisão D1)', () => {
  it('reproduz a tabela do plano para «adorei»', () => {
    expect(derivarBalde('adorei', 1)).toEqual([9.0]);
    expect(derivarBalde('adorei', 2)).toEqual([9.3, 8.8]);
    expect(derivarBalde('adorei', 3)).toEqual([9.5, 9.0, 8.5]);
    expect(derivarBalde('adorei', 4)).toEqual([9.8, 9.3, 8.8, 8.3]);
    expect(derivarBalde('adorei', 5)).toEqual([10.0, 9.5, 9.0, 8.5, 8.0]);
  });

  it('um título sozinho fica no centro do intervalo, nunca no topo', () => {
    // O ponto da decisão D1: um 10.0 tem de ser ganho. Se o primeiro «adorei»
    // valesse 10.0, toda a gente teria um 10.0 ao fim de um minuto de uso.
    expect(derivar('adorei', 1, 1)).toBe(9.0);
    expect(derivar('gostei', 1, 1)).toBe(6.5);
    expect(derivar('nah', 1, 1)).toBe(2.5);
  });

  it('só o balde cheio usa o intervalo todo', () => {
    for (const b of BALDES) {
      const { base, topo } = INTERVALO[b];
      const cheio = derivarBalde(b, 5);
      expect(cheio[0]).toBe(topo);
      expect(cheio[cheio.length - 1]).toBe(base);

      const quaseCheio = derivarBalde(b, 4);
      expect(quaseCheio[0]!).toBeLessThan(topo);
      expect(quaseCheio[quaseCheio.length - 1]!).toBeGreaterThan(base);
    }
  });

  it('acima de 5 continua a usar o intervalo todo', () => {
    for (const n of [6, 10, 50, 500]) {
      const notas = derivarBalde('gostei', n);
      expect(notas[0]).toBe(INTERVALO.gostei.topo);
      expect(notas[notas.length - 1]).toBe(INTERVALO.gostei.base);
    }
  });

  it('a amplitude cresce de 0 a 1 e nunca passa disso', () => {
    expect(amplitude(1)).toBe(0);
    expect(amplitude(5)).toBe(1);
    expect(amplitude(1000)).toBe(1);
    for (let n = 1; n < 20; n += 1) {
      expect(amplitude(n)).toBeLessThanOrEqual(amplitude(n + 1));
    }
  });
});

describe('propriedades da derivação', () => {
  it('nenhuma nota sai do intervalo do seu balde, para nenhum tamanho', () => {
    for (const b of BALDES) {
      const { base, topo } = INTERVALO[b];
      for (let n = 1; n <= 60; n += 1) {
        for (const nota of derivarBalde(b, n)) {
          expect(nota).toBeGreaterThanOrEqual(base);
          expect(nota).toBeLessThanOrEqual(topo);
        }
      }
    }
  });

  it('as notas descem sempre com o lugar, sem empates', () => {
    for (const b of BALDES) {
      // Acima de ~30 num balde de 2.0 pontos, o arredondamento a uma casa
      // obriga a empates: são só 21 valores possíveis. Até lá, sem empates.
      for (let n = 2; n <= 20; n += 1) {
        const notas = derivarBalde(b, n);
        for (let i = 1; i < notas.length; i += 1) {
          expect(notas[i]!).toBeLessThan(notas[i - 1]!);
        }
      }
    }
  });

  it('num balde grande as notas nunca sobem, mesmo com empates', () => {
    for (const b of BALDES) {
      const notas = derivarBalde(b, 200);
      for (let i = 1; i < notas.length; i += 1) {
        expect(notas[i]!).toBeLessThanOrEqual(notas[i - 1]!);
      }
    }
  });

  it('um lugar fora do balde é um erro, não um número inventado', () => {
    expect(() => derivar('adorei', 0, 3)).toThrow(RangeError);
    expect(() => derivar('adorei', 4, 3)).toThrow(RangeError);
    expect(() => derivar('adorei', 1, 0)).toThrow(RangeError);
  });
});

describe('derivação de um âmbito inteiro', () => {
  const item = (subjectId: string, balde: Balde, posicao: number) => ({
    subjectId,
    balde,
    posicao,
  });

  it('o lugar conta-se dentro do balde, não no ranking todo', () => {
    // O 3.º do ranking é o 1.º «gostei», e é como «gostei» que é avaliado.
    const notas = derivarAmbito([
      item('a', 'adorei', 1024),
      item('b', 'adorei', 2048),
      item('c', 'gostei', 3072),
      item('d', 'gostei', 4096),
    ]);
    const por = new Map(notas.map((n) => [n.subjectId, n.nota]));
    expect(por.get('a')).toBe(9.3);
    expect(por.get('b')).toBe(8.8);
    // «gostei» é 5.0–7.9: centro 6.45, meia-amplitude 0.3625 com dois títulos.
    expect(por.get('c')).toBe(6.8);
    expect(por.get('d')).toBe(6.1);
  });

  it('cada nota cai no intervalo do seu próprio balde', () => {
    const notas = derivarAmbito([
      item('a', 'adorei', 1024),
      item('b', 'gostei', 2048),
      item('c', 'nah', 3072),
    ]);
    for (const n of notas) {
      const { base, topo } = INTERVALO[n.balde];
      expect(n.nota).toBeGreaterThanOrEqual(base);
      expect(n.nota).toBeLessThanOrEqual(topo);
    }
  });

  it('a ordem das entradas não muda o resultado', () => {
    const entradas = [
      item('a', 'adorei', 1024),
      item('b', 'adorei', 2048),
      item('c', 'gostei', 3072),
    ];
    const direita = derivarAmbito(entradas);
    const baralhada = derivarAmbito([...entradas].reverse());
    const mapa = (l: readonly { subjectId: string; nota: number }[]) =>
      new Map(l.map((n) => [n.subjectId, n.nota]));
    expect(mapa(baralhada)).toEqual(mapa(direita));
  });
});

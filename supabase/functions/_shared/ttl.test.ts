import { describe, expect, it } from 'vitest';
import { comoIntervalo, DIA, fresco, HORA, ttl } from './ttl.ts';
import type { Detalhe } from './tmdb.ts';

const AGORA = new Date('2026-08-29T12:00:00Z');

function detalhe(p: Partial<Detalhe>): Detalhe {
  return {
    tmdbId: 1,
    genero: 'movie',
    titulo: 't',
    tituloOriginal: null,
    ano: 2020,
    posterPath: null,
    sinopse: null,
    popularidade: 0,
    lingua: null,
    estado: 'Released',
    temporadas: [],
    ...p,
  };
}

describe('ttl', () => {
  it.each([
    ['série terminada', { genero: 'tv', estado: 'Ended' }, 30 * DIA],
    ['série cancelada', { genero: 'tv', estado: 'Canceled' }, 30 * DIA],
    ['série em emissão', { genero: 'tv', estado: 'Returning Series' }, DIA],
    ['série sem estado declarado', { genero: 'tv', estado: null }, DIA],
    ['filme antigo', { genero: 'movie', ano: 1999, estado: 'Released' }, 90 * DIA],
    ['filme deste ano', { genero: 'movie', ano: 2026, estado: 'Released' }, 7 * DIA],
    [
      'filme por estrear',
      { genero: 'movie', ano: 2027, estado: 'Post Production' },
      7 * DIA,
    ],
    ['filme sem ano', { genero: 'movie', ano: null, estado: 'Released' }, 7 * DIA],
  ] as const)('%s → %i ms', (_, p, esperado) => {
    expect(ttl(detalhe(p as Partial<Detalhe>), AGORA)).toBe(esperado);
  });

  it('uma série sem estado é tratada como em emissão, não como acabada', () => {
    // Errar para o lado de revalidar de mais custa um pedido. Errar para o
    // outro lado esconde episódios novos durante um mês.
    expect(ttl(detalhe({ genero: 'tv', estado: null }), AGORA)).toBeLessThan(
      ttl(detalhe({ genero: 'tv', estado: 'Ended' }), AGORA),
    );
  });
});

describe('frescura', () => {
  it('dentro do prazo serve, fora não', () => {
    const ha2h = new Date(AGORA.getTime() - 2 * HORA);
    expect(fresco(ha2h, DIA, AGORA)).toBe(true);
    expect(fresco(ha2h, HORA, AGORA)).toBe(false);
  });

  it('exactamente no limite já não serve', () => {
    const ha1d = new Date(AGORA.getTime() - DIA);
    expect(fresco(ha1d, DIA, AGORA)).toBe(false);
  });
});

describe('intervalo do postgres', () => {
  it('converte para segundos', () => {
    expect(comoIntervalo(DIA)).toBe('86400 seconds');
    expect(comoIntervalo(90 * DIA)).toBe('7776000 seconds');
  });
});

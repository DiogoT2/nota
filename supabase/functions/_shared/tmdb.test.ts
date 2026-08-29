import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  anoDaData,
  generoDe,
  normalizarDetalhe,
  normalizarPesquisa,
  normalizarResultado,
  normalizarTemporada,
  numerosDeTemporada,
} from './tmdb.ts';

/**
 * As respostas são gravadas do TMDB a sério, uma vez, e ficam no repositório.
 * O CI não faz uma única chamada de rede — última caixa da Fase 2 no PLAN.md.
 *
 * O ficheiro com prefixo `DERIVADO-` não foi gravado: é uma resposta real com
 * a sinopse e o título esvaziados à mão, porque nenhuma das respostas que
 * apanhámos vinha sem tradução e o ramo do fallback precisa desse caso.
 */
export function gravado(nome: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(__dirname, 'gravado', nome), 'utf8'));
}

describe('normalização', () => {
  it('um filme e uma série produzem o mesmo formato', () => {
    const filme = normalizarDetalhe(gravado('filme-550-pt.json'), 'movie');
    const serie = normalizarDetalhe(gravado('serie-1396-pt.json'), 'tv');

    expect(Object.keys(filme!).sort()).toEqual(Object.keys(serie!).sort());
    expect(filme).toMatchObject({
      tmdbId: 550,
      genero: 'movie',
      titulo: 'Clube de Combate',
      ano: 1999,
      estado: 'Released',
    });
    expect(serie).toMatchObject({
      tmdbId: 1396,
      genero: 'tv',
      titulo: 'Breaking Bad',
      ano: 2008,
      estado: 'Ended',
    });
  });

  it('nunca guarda uma URL de imagem, só o caminho', () => {
    const filme = normalizarDetalhe(gravado('filme-550-pt.json'), 'movie')!;
    expect(filme.posterPath).toMatch(/^\//);
    expect(JSON.stringify(filme)).not.toContain('image.tmdb.org');
    expect(JSON.stringify(filme)).not.toContain('http');
  });

  it('a pesquisa devolve filmes e séries numa lista só, sem pessoas', () => {
    const r = normalizarPesquisa(gravado('pesquisa-breaking-bad.json'));
    expect(r.length).toBeGreaterThan(0);
    expect(new Set(r.map((x) => x.genero)).size).toBeGreaterThanOrEqual(1);
    for (const x of r) expect(['movie', 'tv']).toContain(x.genero);
    // A resposta crua traz pessoas; nenhuma sobrevive à normalização.
    const cru = gravado('pesquisa-breaking-bad.json');
    const pessoas = (cru['results'] as { media_type?: string }[]).filter(
      (l) => l.media_type === 'person',
    );
    expect(r.length).toBe((cru['results'] as unknown[]).length - pessoas.length);
  });

  it('descarta um resultado sem título nenhum, em vez de o mostrar vazio', () => {
    expect(normalizarResultado({ id: 1, media_type: 'movie' })).toBeNull();
    expect(normalizarResultado({ id: 1, media_type: 'movie', title: '   ' })).toBeNull();
    expect(
      normalizarResultado({ id: 1, media_type: 'movie', original_title: 'Fight Club' }),
    ).toMatchObject({ titulo: 'Fight Club' });
  });

  it('deduz o género pela forma quando o TMDB não o declara', () => {
    expect(generoDe({ title: 'x' })).toBe('movie');
    expect(generoDe({ name: 'x' })).toBe('tv');
    expect(generoDe({ media_type: 'tv', title: 'x' })).toBe('tv');
    expect(generoDe({})).toBeNull();
  });

  it('uma data vazia dá ano nulo, não o ano zero', () => {
    expect(anoDaData('2008-01-20')).toBe(2008);
    expect(anoDaData('')).toBeNull();
    expect(anoDaData(null)).toBeNull();
    expect(anoDaData('sem data')).toBeNull();
  });
});

describe('temporadas', () => {
  it('a temporada 0 dos especiais é uma temporada como as outras', () => {
    const numeros = numerosDeTemporada(gravado('serie-1396-pt.json'));
    expect(numeros).toContain(0);
    expect(numeros[0]).toBe(0);

    const t0 = normalizarTemporada(
      { season_number: 0, name: 'Especiais' },
      gravado('serie-1396-t0-pt.json')['episodes'],
    );
    expect(t0!.numero).toBe(0);
    expect(t0!.episodios.length).toBeGreaterThan(0);
  });

  it('lê os episódios de uma temporada normal', () => {
    const t1 = normalizarTemporada(
      { season_number: 1 },
      gravado('serie-1396-t1-pt.json')['episodes'],
    );
    expect(t1!.episodios.length).toBe(7);
    expect(t1!.episodios[0]).toMatchObject({ numero: 1 });
    // Os números não são o índice: um episódio em falta não desloca os outros.
    expect(t1!.episodios.map((e) => e.numero)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

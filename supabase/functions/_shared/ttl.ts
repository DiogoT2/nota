/**
 * F2-3 · TTL diferenciado.
 *
 * Um filme de 1999 não muda. Uma série em emissão ganha episódios todas as
 * semanas, e um episódio que falta é uma nota que alguém não consegue dar.
 *
 * A entrada é o `status` que o TMDB declara, não uma adivinhação a partir da
 * data de estreia: uma série pode estar parada há três anos e voltar, e a data
 * não diz isso — o `status` diz.
 */

import type { Detalhe } from './tmdb.ts';

export const HORA = 60 * 60 * 1000;
export const DIA = 24 * HORA;

/** Séries que o TMDB dá por acabadas. Tudo o resto pode ganhar episódios. */
const ACABADAS = new Set(['Ended', 'Canceled', 'Cancelled']);

/** Filmes já estreados e fechados. */
const ESTREADOS = new Set(['Released']);

export function ttl(detalhe: Detalhe, agora: Date = new Date()): number {
  if (detalhe.genero === 'tv') {
    // Em emissão: revalida todos os dias. É o único caso em que o cache nos
    // pode fazer perder conteúdo que o utilizador quer avaliar hoje.
    return ACABADAS.has(detalhe.estado ?? '') ? 30 * DIA : DIA;
  }

  // Um filme por estrear ainda muda de data, de cartaz e de sinopse.
  if (detalhe.estado !== null && !ESTREADOS.has(detalhe.estado)) return 7 * DIA;

  const anoActual = agora.getUTCFullYear();
  if (detalhe.ano === null) return 7 * DIA;

  // Um filme com mais de um ano está estabilizado: o cartaz e a sinopse já não
  // mudam, e as traduções que faltavam já foram feitas ou não vão ser.
  return detalhe.ano < anoActual ? 90 * DIA : 7 * DIA;
}

/** Um registo em cache ainda serve? */
export function fresco(
  buscadoEm: Date,
  ttlMs: number,
  agora: Date = new Date(),
): boolean {
  return agora.getTime() - buscadoEm.getTime() < ttlMs;
}

/** `interval` do Postgres, para gravar em `titles.ttl`. */
export function comoIntervalo(ttlMs: number): string {
  return `${Math.round(ttlMs / 1000)} seconds`;
}

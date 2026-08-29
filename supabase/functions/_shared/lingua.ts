/**
 * F2-2 · Fallback de língua.
 *
 * O TMDB devolve `overview` vazio quando não há tradução — não devolve o
 * inglês. Um filme menos conhecido em `pt-PT` chega com nome traduzido e
 * sinopse em branco, e um ecrã de detalhe com a sinopse vazia parece partido.
 *
 * A regra: preenche-se **apenas o que está vazio**. Um título com sinopse em
 * português e nome original em inglês não é sobreposto pela versão inglesa —
 * seria trocar uma tradução boa por outra pior por causa de um campo ao lado.
 */

import type { Detalhe, Resultado } from './tmdb.ts';

export const LINGUA_PRINCIPAL = 'pt-PT';
export const LINGUA_RESERVA = 'en-US';

/** Um campo precisa de reserva? */
const vazio = (v: string | null | undefined): boolean =>
  v === null || v === undefined || v.trim() === '';

/** Falta alguma coisa que valha uma segunda chamada? */
export function precisaDeReserva(r: Pick<Resultado, 'titulo' | 'sinopse'>): boolean {
  return vazio(r.titulo) || vazio(r.sinopse);
}

/**
 * Junta o principal com a reserva, campo a campo. O principal ganha sempre que
 * tenha alguma coisa.
 */
export function preencher<T extends Resultado>(
  principal: T,
  reserva: Resultado | null,
): T {
  if (reserva === null) return principal;
  return {
    ...principal,
    titulo: vazio(principal.titulo) ? reserva.titulo : principal.titulo,
    tituloOriginal: vazio(principal.tituloOriginal)
      ? reserva.tituloOriginal
      : principal.tituloOriginal,
    sinopse: vazio(principal.sinopse) ? reserva.sinopse : principal.sinopse,
    // O cartaz também é traduzido: o TMDB tem versões com o título na língua.
    // Se não houver em português, o internacional serve.
    posterPath: principal.posterPath ?? reserva.posterPath,
  };
}

/**
 * O mesmo para as temporadas de uma série: os nomes dos episódios são o campo
 * que mais vezes falta, e um episódio sem nome numa lista é uma linha vazia.
 */
export function preencherDetalhe(principal: Detalhe, reserva: Detalhe | null): Detalhe {
  const base = preencher(principal, reserva);
  if (reserva === null) return base;

  const porNumero = new Map(reserva.temporadas.map((t) => [t.numero, t]));

  return {
    ...base,
    temporadas: principal.temporadas.map((t) => {
      const outra = porNumero.get(t.numero);
      if (outra === undefined) return t;
      const episodiosReserva = new Map(outra.episodios.map((e) => [e.numero, e]));
      return {
        ...t,
        nome: vazio(t.nome) ? outra.nome : t.nome,
        episodios: t.episodios.map((e) => {
          const er = episodiosReserva.get(e.numero);
          if (er === undefined || !vazio(e.nome)) return e;
          return { ...e, nome: er.nome };
        }),
      };
    }),
  };
}

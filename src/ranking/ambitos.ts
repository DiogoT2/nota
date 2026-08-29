/**
 * F3-5 · Os três âmbitos independentes.
 *
 * Filmes, séries e episódios-de-uma-série são rankings separados. Um episódio
 * nunca compara com um filme — não porque seja proibido, mas porque a pergunta
 * «qual é melhor, o piloto de Breaking Bad ou o Clube de Combate?» não tem
 * resposta útil.
 *
 * A separação é imposta por tipos, não por disciplina: não há como construir um
 * âmbito de episódios sem dizer de que série são.
 */

import type { Balde } from './baldes.ts';

export type Gen = 'movie' | 'show' | 'episode';

/** Espelha `public.scope_global()` do esquema. NULL não serve num índice único. */
export const AMBITO_GLOBAL = '00000000-0000-0000-0000-000000000000';

export type Ambito =
  | { readonly genero: 'movie'; readonly scopeId: typeof AMBITO_GLOBAL }
  | { readonly genero: 'show'; readonly scopeId: typeof AMBITO_GLOBAL }
  /** `scopeId` é o `titles.id` da série a que o episódio pertence. */
  | { readonly genero: 'episode'; readonly scopeId: string };

export const ambitoDeFilmes: Ambito = { genero: 'movie', scopeId: AMBITO_GLOBAL };
export const ambitoDeSeries: Ambito = { genero: 'show', scopeId: AMBITO_GLOBAL };

export function ambitoDeEpisodios(serieId: string): Ambito {
  if (serieId === AMBITO_GLOBAL) {
    throw new Error('um âmbito de episódios precisa da série a que pertencem');
  }
  return { genero: 'episode', scopeId: serieId };
}

export function mesmoAmbito(a: Ambito, b: Ambito): boolean {
  return a.genero === b.genero && a.scopeId === b.scopeId;
}

export function chave(a: Ambito): string {
  return `${a.genero}:${a.scopeId}`;
}

/** Um título colocado, com tudo o que o motor precisa de saber sobre ele. */
export type Entrada = {
  readonly subjectId: string;
  readonly balde: Balde;
  readonly posicao: number;
  /** Arrastado à mão. Nenhuma comparação o move sozinho. Decisão D2. */
  readonly pregado: boolean;
};

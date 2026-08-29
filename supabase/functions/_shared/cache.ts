/**
 * O cache em Postgres. É esta a defesa real contra a quota do TMDB — o
 * deduplicador cobre a rajada num isolate, isto cobre tudo o resto.
 *
 * Escreve com `service_role`, porque `titles`, `seasons` e `episodes` só
 * aceitam escrita dessa origem: são metadados do TMDB, não dados de
 * utilizador, e ninguém os edita a partir da app.
 *
 * O acesso é por SQL sobre PostgREST e não pelo `supabase-js` de propósito —
 * o núcleo não importa nada do Deno nem do runtime, o que o mantém testável
 * em Vitest (decisão D2 em docs/plano/fase-2.md).
 */

import { ErroTmdb } from './erros.ts';
import { comoIntervalo, fresco, ttl } from './ttl.ts';
import type { Detalhe, Genero } from './tmdb.ts';

export type LinhaTitulo = {
  readonly id: string;
  readonly tmdb_id: number;
  readonly kind: Genero;
  readonly fetched_at: string;
  readonly ttl: string;
};

/** O que a Edge Function devolve ao cliente depois de materializar um título. */
export type TituloMaterializado = Detalhe & {
  /** O nosso uuid. É com este que `buckets` e `rank_positions` trabalham. */
  readonly id: string;
  readonly doCache: boolean;
};

export type Rest = {
  readonly url: string;
  readonly chave: string;
  readonly buscar?: typeof fetch;
};

async function pedir(
  rest: Rest,
  caminho: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<unknown> {
  const buscar = rest.buscar ?? fetch;
  const { prefer, ...resto } = init;
  const r = await buscar(`${rest.url}/rest/v1/${caminho}`, {
    ...resto,
    headers: {
      apikey: rest.chave,
      Authorization: `Bearer ${rest.chave}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
      ...(resto.headers ?? {}),
    },
  });
  if (!r.ok) {
    throw new ErroTmdb(
      'upstream',
      `postgrest ${r.status}: ${await r.text().catch(() => '')}`,
    );
  }
  const texto = await r.text();
  return texto === '' ? null : JSON.parse(texto);
}

/** O título já está em cache, e ainda dentro do prazo? */
export async function emCache(
  rest: Rest,
  genero: Genero,
  tmdbId: number,
  agora: Date = new Date(),
): Promise<LinhaTitulo | null> {
  const linhas = (await pedir(
    rest,
    `titles?select=id,tmdb_id,kind,fetched_at,ttl&tmdb_id=eq.${tmdbId}&kind=eq.${genero}`,
  )) as LinhaTitulo[];

  const linha = linhas[0];
  if (linha === undefined) return null;

  // `ttl` chega do Postgres como `90 days` ou `7776000 seconds`. Só nos
  // interessa comparar com o tempo decorrido, e a forma de segundos é a que
  // escrevemos — mas uma base semeada à mão pode ter a outra.
  const segundos = /^(\d+) seconds?$/.exec(linha.ttl.trim())?.[1];
  const dias = /^(\d+) days?$/.exec(linha.ttl.trim())?.[1];
  const ms =
    segundos !== undefined
      ? Number(segundos) * 1000
      : dias !== undefined
        ? Number(dias) * 86_400_000
        : 0;

  return fresco(new Date(linha.fetched_at), ms, agora) ? linha : null;
}

/**
 * Grava o detalhe. Upsert em `titles`, e para séries também as temporadas e os
 * episódios — a temporada 0 dos especiais incluída, que é uma temporada como as
 * outras e não um caso à parte.
 */
export async function guardar(
  rest: Rest,
  detalhe: Detalhe,
  agora: Date = new Date(),
): Promise<string> {
  const linhas = (await pedir(rest, 'titles?on_conflict=tmdb_id,kind', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify([
      {
        tmdb_id: detalhe.tmdbId,
        kind: detalhe.genero,
        title: detalhe.titulo,
        original_title: detalhe.tituloOriginal,
        year: detalhe.ano,
        // Só o caminho. Nunca a URL — proibição permanente do CLAUDE.md.
        poster_path: detalhe.posterPath,
        overview: detalhe.sinopse,
        lang: detalhe.lingua,
        status: detalhe.estado,
        fetched_at: agora.toISOString(),
        ttl: comoIntervalo(ttl(detalhe, agora)),
      },
    ]),
  })) as { id: string }[];

  const id = linhas[0]?.id;
  if (id === undefined) throw new ErroTmdb('upstream', 'upsert de título sem id');

  if (detalhe.genero === 'tv' && detalhe.temporadas.length > 0) {
    await guardarTemporadas(rest, id, detalhe.temporadas);
  }

  return id;
}

async function guardarTemporadas(
  rest: Rest,
  tituloId: string,
  temporadas: Detalhe['temporadas'],
): Promise<void> {
  const gravadas = (await pedir(rest, 'seasons?on_conflict=title_id,number', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify(
      temporadas.map((t) => ({ title_id: tituloId, number: t.numero, name: t.nome })),
    ),
  })) as { id: string; number: number }[];

  const porNumero = new Map(gravadas.map((s) => [s.number, s.id]));

  const episodios = temporadas.flatMap((t) => {
    const seasonId = porNumero.get(t.numero);
    if (seasonId === undefined) return [];
    return t.episodios.map((e) => ({
      season_id: seasonId,
      number: e.numero,
      name: e.nome,
      air_date: e.estreia,
    }));
  });

  if (episodios.length === 0) return;

  await pedir(rest, 'episodes?on_conflict=season_id,number', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify(episodios),
  });
}

/** O detalhe completo de um título já em cache, para não voltar ao TMDB. */
export async function lerDoCache(rest: Rest, id: string): Promise<Detalhe | null> {
  const linhas = (await pedir(
    rest,
    `titles?select=*,seasons(number,name,episodes(number,name,air_date))&id=eq.${id}`,
  )) as Record<string, unknown>[];

  const l = linhas[0];
  if (l === undefined) return null;

  const temporadas = (
    (l['seasons'] as { number: number; name: string | null; episodes: unknown[] }[]) ?? []
  )
    .map((s) => ({
      numero: s.number,
      nome: s.name,
      episodios: (
        (s.episodes ?? []) as {
          number: number;
          name: string | null;
          air_date: string | null;
        }[]
      )
        .map((e) => ({ numero: e.number, nome: e.name, estreia: e.air_date }))
        .sort((a, b) => a.numero - b.numero),
    }))
    .sort((a, b) => a.numero - b.numero);

  return {
    tmdbId: l['tmdb_id'] as number,
    genero: l['kind'] as Genero,
    titulo: (l['title'] as string) ?? '',
    tituloOriginal: (l['original_title'] as string | null) ?? null,
    ano: (l['year'] as number | null) ?? null,
    posterPath: (l['poster_path'] as string | null) ?? null,
    sinopse: (l['overview'] as string | null) ?? null,
    popularidade: 0,
    lingua: (l['lang'] as string | null) ?? null,
    estado: (l['status'] as string | null) ?? null,
    temporadas,
  };
}

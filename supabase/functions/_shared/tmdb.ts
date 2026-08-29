/**
 * F2-1 · Tipos e normalização.
 *
 * Um filme e uma série chegam do TMDB com formas diferentes: `title` contra
 * `name`, `release_date` contra `first_air_date`. Essa diferença é do TMDB, não
 * do nosso produto, e morre aqui. O resto da app vê um tipo só.
 *
 * Nunca guardamos URL de imagem, só `poster_path`. Guardar a URL inteira fixaria
 * o domínio e o tamanho escolhidos pelo TMDB dentro da nossa base de dados, e
 * mudá-los passaria a ser uma migração. É proibição permanente do CLAUDE.md.
 */

export type Genero = 'movie' | 'tv';

/** O que a pesquisa devolve. Ainda não existe na nossa base. */
export type Resultado = {
  readonly tmdbId: number;
  readonly genero: Genero;
  readonly titulo: string;
  readonly tituloOriginal: string | null;
  readonly ano: number | null;
  readonly posterPath: string | null;
  readonly sinopse: string | null;
  /** Serve para ordenar a pesquisa; não é uma nota e nunca é mostrado. */
  readonly popularidade: number;
};

export type Episodio = {
  readonly numero: number;
  readonly nome: string | null;
  readonly estreia: string | null;
};

export type Temporada = {
  /** 0 é a temporada de especiais. É legítima, não é um caso de erro. */
  readonly numero: number;
  readonly nome: string | null;
  readonly episodios: readonly Episodio[];
};

export type Detalhe = Resultado & {
  readonly lingua: string | null;
  /** `Ended`, `Canceled`, `Returning Series`, `Released`… Entrada do TTL. */
  readonly estado: string | null;
  readonly temporadas: readonly Temporada[];
};

/** Uma resposta do TMDB, antes de sabermos o que lá está dentro. */
type Bruto = Record<string, unknown>;

const texto = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
};

const numero = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** `2008-01-20` → 2008. Uma data vazia é `null`, não o ano zero. */
export function anoDaData(v: unknown): number | null {
  const t = texto(v);
  if (t === null) return null;
  const ano = Number.parseInt(t.slice(0, 4), 10);
  return Number.isFinite(ano) ? ano : null;
}

/**
 * O género vem do campo `media_type` na pesquisa múltipla, e do endpoint quando
 * já sabemos qual é. Quando nenhum dos dois responde, a forma diz: só um filme
 * tem `title`, só uma série tem `name`.
 */
export function generoDe(bruto: Bruto, sugestao?: Genero): Genero | null {
  const declarado = texto(bruto['media_type']);
  if (declarado === 'movie' || declarado === 'tv') return declarado;
  if (sugestao) return sugestao;
  if (typeof bruto['title'] === 'string') return 'movie';
  if (typeof bruto['name'] === 'string') return 'tv';
  return null;
}

export function normalizarResultado(bruto: Bruto, sugestao?: Genero): Resultado | null {
  const genero = generoDe(bruto, sugestao);
  const tmdbId = numero(bruto['id']);
  if (genero === null || tmdbId === null) return null;

  // É aqui que a diferença entre filme e série acaba.
  const titulo = genero === 'movie' ? texto(bruto['title']) : texto(bruto['name']);
  const tituloOriginal =
    genero === 'movie' ? texto(bruto['original_title']) : texto(bruto['original_name']);
  const data = genero === 'movie' ? bruto['release_date'] : bruto['first_air_date'];

  // Um resultado sem título nenhum não é mostrável. Acontece com entradas
  // incompletas do TMDB, e é melhor desaparecer da lista do que aparecer vazio.
  if (titulo === null && tituloOriginal === null) return null;

  return {
    tmdbId,
    genero,
    titulo: titulo ?? tituloOriginal ?? '',
    tituloOriginal,
    ano: anoDaData(data),
    posterPath: texto(bruto['poster_path']),
    sinopse: texto(bruto['overview']),
    popularidade: numero(bruto['popularity']) ?? 0,
  };
}

/** Uma página de resultados de pesquisa, já limpa do que não é mostrável. */
export function normalizarPesquisa(
  bruto: Bruto,
  sugestao?: Genero,
): readonly Resultado[] {
  const linhas = Array.isArray(bruto['results']) ? bruto['results'] : [];
  return linhas
    .filter((l): l is Bruto => typeof l === 'object' && l !== null)
    .map((l) => normalizarResultado(l, sugestao))
    .filter((r): r is Resultado => r !== null);
}

function normalizarEpisodio(bruto: Bruto): Episodio | null {
  const numeroEp = numero(bruto['episode_number']);
  if (numeroEp === null) return null;
  return {
    numero: numeroEp,
    nome: texto(bruto['name']),
    estreia: texto(bruto['air_date']),
  };
}

/**
 * Uma temporada com os episódios dentro. O TMDB entrega os episódios num
 * endpoint separado (`/tv/{id}/season/{n}`), por isso `episodios` vem de fora.
 */
export function normalizarTemporada(
  bruto: Bruto,
  episodiosBrutos: unknown,
): Temporada | null {
  const numeroT = numero(bruto['season_number']);
  if (numeroT === null) return null;

  const lista = Array.isArray(episodiosBrutos) ? episodiosBrutos : [];
  return {
    numero: numeroT,
    nome: texto(bruto['name']),
    episodios: lista
      .filter((e): e is Bruto => typeof e === 'object' && e !== null)
      .map(normalizarEpisodio)
      .filter((e): e is Episodio => e !== null),
  };
}

export function normalizarDetalhe(
  bruto: Bruto,
  genero: Genero,
  temporadas: readonly Temporada[] = [],
): Detalhe | null {
  const base = normalizarResultado(bruto, genero);
  if (base === null) return null;
  return {
    ...base,
    lingua: texto(bruto['original_language']),
    estado: texto(bruto['status']),
    temporadas,
  };
}

/**
 * As temporadas declaradas num detalhe de série, para sabermos quais ir buscar.
 * Inclui a 0 — os especiais são uma temporada como as outras e o produto trata-a
 * explicitamente.
 */
export function numerosDeTemporada(bruto: Bruto): readonly number[] {
  const lista = Array.isArray(bruto['seasons']) ? bruto['seasons'] : [];
  return lista
    .filter((s): s is Bruto => typeof s === 'object' && s !== null)
    .map((s) => numero(s['season_number']))
    .filter((n): n is number => n !== null && n >= 0)
    .sort((a, b) => a - b);
}

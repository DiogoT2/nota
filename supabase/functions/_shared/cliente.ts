/**
 * O cliente do TMDB. Junta backoff, deduplicação, fallback de língua e
 * normalização numa superfície pequena.
 *
 * `fetch` entra por parâmetro — é isto que torna toda a Fase 2 testável sem
 * rede. O teste passa uma função que devolve respostas gravadas; o CI não faz
 * uma única chamada real, que é a última caixa do PLAN.md para esta fase.
 *
 * Autenticação por `Authorization: Bearer` com o token v4 (ADR: decisão D3 em
 * docs/plano/fase-2.md). Uma chave na query string ficaria nos logs de todos os
 * proxies por onde a chamada passasse.
 */

import {
  comBackoff,
  relogioReal,
  retryAfter,
  type Politica,
  type Relogio,
} from './backoff.ts';
import { Deduplicador } from './dedup.ts';
import { daResposta, ErroTmdb } from './erros.ts';
import {
  LINGUA_PRINCIPAL,
  LINGUA_RESERVA,
  precisaDeReserva,
  preencher,
  preencherDetalhe,
} from './lingua.ts';
import {
  normalizarDetalhe,
  normalizarPesquisa,
  normalizarTemporada,
  numerosDeTemporada,
  type Detalhe,
  type Genero,
  type Resultado,
  type Temporada,
} from './tmdb.ts';

const BASE = 'https://api.themoviedb.org/3';

export type Opcoes = {
  readonly token: string;
  readonly buscar?: typeof fetch;
  readonly relogio?: Relogio;
  readonly politica?: Politica;
  readonly base?: string;
};

export class ClienteTmdb {
  readonly #token: string;
  readonly #buscar: typeof fetch;
  readonly #relogio: Relogio;
  readonly #politica: Politica | undefined;
  readonly #base: string;
  readonly #dedup = new Deduplicador<unknown>();

  constructor(opcoes: Opcoes) {
    this.#token = opcoes.token;
    this.#buscar = opcoes.buscar ?? fetch;
    this.#relogio = opcoes.relogio ?? relogioReal;
    this.#politica = opcoes.politica;
    this.#base = opcoes.base ?? BASE;
  }

  /** Uma chamada crua, com backoff e sem deduplicação. */
  async #cru(
    caminho: string,
    params: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(this.#base + caminho);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    let ultimoRetryAfter: number | null = null;

    return comBackoff(
      async () => {
        const r = await this.#buscar(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.#token}`,
            Accept: 'application/json',
          },
        });

        if (!r.ok) {
          ultimoRetryAfter = retryAfter(r.headers.get('retry-after'));
          // O corpo do TMDB fica no erro para o NOSSO log. `corpoDoErro()` não
          // o serializa, portanto não chega ao cliente.
          throw daResposta(r.status, await r.text().catch(() => ''));
        }

        return (await r.json()) as Record<string, unknown>;
      },
      {
        ...(this.#politica ? { politica: this.#politica } : {}),
        relogio: this.#relogio,
        esperaSugerida: () => ultimoRetryAfter,
      },
    );
  }

  /** Deduplica pedidos idênticos em voo. */
  #pedir(chave: string, produzir: () => Promise<unknown>): Promise<unknown> {
    return this.#dedup.uma(chave, produzir);
  }

  /**
   * Pesquisa filmes e séries numa lista só.
   *
   * `search/multi` devolve também pessoas, que filtramos: `normalizarPesquisa`
   * descarta tudo o que não tenha `media_type` de filme ou série.
   */
  async pesquisar(query: string, pagina = 1): Promise<readonly Resultado[]> {
    const limpa = query.trim();
    if (limpa === '') return [];

    const bruto = (await this.#pedir(`search:${limpa}:${pagina}`, () =>
      this.#cru('/search/multi', {
        query: limpa,
        page: String(pagina),
        language: LINGUA_PRINCIPAL,
        include_adult: 'false',
      }),
    )) as Record<string, unknown>;

    const resultados = normalizarPesquisa(bruto);

    // Na pesquisa não se faz uma segunda chamada por resultado sem sinopse —
    // seriam vinte chamadas por tecla. O fallback da pesquisa é o título
    // original, que já vem na mesma resposta. A sinopse completa aparece no
    // detalhe, onde uma segunda chamada custa uma e não vinte.
    return resultados.map((r) => ({
      ...r,
      titulo: r.titulo.trim() === '' ? (r.tituloOriginal ?? '') : r.titulo,
    }));
  }

  async detalheDeFilme(tmdbId: number): Promise<Detalhe> {
    return (await this.#pedir(`movie:${tmdbId}`, async () => {
      const principal = await this.#cru(`/movie/${tmdbId}`, {
        language: LINGUA_PRINCIPAL,
      });
      let detalhe = normalizarDetalhe(principal, 'movie');
      if (detalhe === null) throw new ErroTmdb('upstream', 'detalhe de filme ilegível');

      if (precisaDeReserva(detalhe)) {
        const reserva = await this.#cru(`/movie/${tmdbId}`, { language: LINGUA_RESERVA });
        detalhe = preencher(detalhe, normalizarDetalhe(reserva, 'movie'));
      }
      return detalhe;
    })) as Detalhe;
  }

  async detalheDeSerie(tmdbId: number): Promise<Detalhe> {
    return (await this.#pedir(`tv:${tmdbId}`, async () => {
      const principal = await this.#cru(`/tv/${tmdbId}`, { language: LINGUA_PRINCIPAL });
      const numeros = numerosDeTemporada(principal);

      const temporadas = await this.#temporadas(
        tmdbId,
        numeros,
        LINGUA_PRINCIPAL,
        principal,
      );
      let detalhe = normalizarDetalhe(principal, 'tv', temporadas);
      if (detalhe === null) throw new ErroTmdb('upstream', 'detalhe de série ilegível');

      // Numa série, a reserva vale a pena mesmo só por causa dos nomes dos
      // episódios: uma lista de episódios sem nomes não é utilizável, e é o
      // campo que mais vezes falta em pt-PT.
      const faltamNomes = temporadas.some((t) =>
        t.episodios.some((e) => e.nome === null),
      );
      if (precisaDeReserva(detalhe) || faltamNomes) {
        const reserva = await this.#cru(`/tv/${tmdbId}`, { language: LINGUA_RESERVA });
        const temporadasReserva = await this.#temporadas(
          tmdbId,
          numeros,
          LINGUA_RESERVA,
          reserva,
        );
        detalhe = preencherDetalhe(
          detalhe,
          normalizarDetalhe(reserva, 'tv', temporadasReserva),
        );
      }

      return detalhe;
    })) as Detalhe;
  }

  /**
   * Os episódios de cada temporada. A temporada 0 — os especiais — entra como
   * qualquer outra: é uma temporada legítima do produto, não um caso de erro.
   */
  async #temporadas(
    tmdbId: number,
    numeros: readonly number[],
    lingua: string,
    detalheSerie: Record<string, unknown>,
  ): Promise<readonly Temporada[]> {
    const declaradas = Array.isArray(detalheSerie['seasons'])
      ? detalheSerie['seasons']
      : [];
    const porNumero = new Map(
      declaradas
        .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
        .map((s) => [s['season_number'] as number, s]),
    );

    const saida: Temporada[] = [];
    // Em série, não em paralelo: vinte temporadas em paralelo são vinte pedidos
    // simultâneos ao TMDB do mesmo cliente, que é como se pede um 429.
    for (const n of numeros) {
      const bruto = await this.#cru(`/tv/${tmdbId}/season/${n}`, { language: lingua });
      const t = normalizarTemporada(porNumero.get(n) ?? bruto, bruto['episodes']);
      if (t !== null) saida.push(t);
    }
    return saida;
  }

  async detalhe(genero: Genero, tmdbId: number): Promise<Detalhe> {
    return genero === 'movie' ? this.detalheDeFilme(tmdbId) : this.detalheDeSerie(tmdbId);
  }
}

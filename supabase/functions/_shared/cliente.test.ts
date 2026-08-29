import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClienteTmdb } from './cliente.ts';
import { Deduplicador } from './dedup.ts';
import { ErroTmdb } from './erros.ts';
import type { Relogio } from './backoff.ts';

const G = join(__dirname, 'gravado');
const ler = (n: string) => readFileSync(join(G, n), 'utf8');

const semEsperas: Relogio = { esperar: async () => {}, acaso: () => 0.5 };

/**
 * Um `fetch` falso que serve respostas gravadas e conta as chamadas.
 *
 * É isto que cumpre a caixa «testes com respostas gravadas; nenhuma chamada
 * real no CI». O cliente recebe o `fetch` por parâmetro precisamente para que
 * este teste exista sem rede.
 */
function buscarFalso(
  rotas: Record<
    string,
    string | { estado: number; corpo?: string; cabecalhos?: Record<string, string> }
  >,
) {
  const chamadas: string[] = [];
  const buscar = (async (url: string | URL) => {
    const u = new URL(String(url));
    // O `/3` é o prefixo da versão da API e faz parte do pathname. As rotas
    // deste teste são escritas sem ele, por serem mais legíveis assim.
    const caminho = u.pathname.replace(/^\/3/, '');
    const lingua = u.searchParams.get('language');
    const chave = caminho + (lingua ? `?${lingua}` : '');
    chamadas.push(chave);
    const r = rotas[chave];
    if (r === undefined) {
      return new Response('{"status_message":"não gravado"}', { status: 404 });
    }
    if (typeof r === 'string') {
      return new Response(r, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(r.corpo ?? '{}', {
      status: r.estado,
      ...(r.cabecalhos ? { headers: r.cabecalhos } : {}),
    });
  }) as unknown as typeof fetch;
  return { buscar, chamadas };
}

function cliente(rotas: Parameters<typeof buscarFalso>[0]) {
  const { buscar, chamadas } = buscarFalso(rotas);
  return {
    chamadas,
    tmdb: new ClienteTmdb({ token: 'token-de-teste', buscar, relogio: semEsperas }),
  };
}

describe('pesquisa', () => {
  it('devolve filmes e séries normalizados', async () => {
    const { tmdb } = cliente({
      '/search/multi?pt-PT': ler('pesquisa-breaking-bad.json'),
    });
    const r = await tmdb.pesquisar('breaking bad');
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((x) => x.tmdbId === 1396 && x.genero === 'tv')).toBe(true);
  });

  it('uma pesquisa vazia não gasta uma chamada', async () => {
    const { tmdb, chamadas } = cliente({});
    expect(await tmdb.pesquisar('   ')).toEqual([]);
    expect(chamadas).toEqual([]);
  });

  it('não faz uma segunda chamada por resultado sem sinopse', async () => {
    // Vinte chamadas de fallback por tecla seria o custo. O fallback da
    // pesquisa é o título original, que já vem na mesma resposta.
    const { tmdb, chamadas } = cliente({
      '/search/multi?pt-PT': ler('pesquisa-breaking-bad.json'),
    });
    await tmdb.pesquisar('breaking bad');
    expect(chamadas).toHaveLength(1);
  });
});

describe('detalhe de filme', () => {
  it('não pede a reserva quando o português está completo', async () => {
    const { tmdb, chamadas } = cliente({ '/movie/550?pt-PT': ler('filme-550-pt.json') });
    const d = await tmdb.detalheDeFilme(550);
    expect(d.titulo).toBe('Clube de Combate');
    expect(chamadas).toEqual(['/movie/550?pt-PT']);
  });

  it('preenche com en-US apenas o que veio vazio', async () => {
    const { tmdb, chamadas } = cliente({
      '/movie/550?pt-PT': ler('DERIVADO-filme-550-sem-traducao-pt.json'),
      '/movie/550?en-US': ler('filme-550-en.json'),
    });
    const d = await tmdb.detalheDeFilme(550);

    expect(chamadas).toEqual(['/movie/550?pt-PT', '/movie/550?en-US']);
    expect(d.titulo).toBe('Fight Club');
    expect(d.sinopse).toBeTruthy();
    // O que não estava vazio continua a ser o da resposta portuguesa.
    expect(d.tmdbId).toBe(550);
    expect(d.ano).toBe(1999);
  });
});

describe('detalhe de série', () => {
  const rotasSerie = {
    '/tv/1396?pt-PT': ler('serie-1396-pt.json'),
    '/tv/1396/season/0?pt-PT': ler('serie-1396-t0-pt.json'),
    '/tv/1396/season/1?pt-PT': ler('serie-1396-t1-pt.json'),
  };

  it('traz as temporadas com episódios, incluindo a 0 dos especiais', async () => {
    // A série tem 5 temporadas + especiais; só gravámos a 0 e a 1, e as que
    // faltam respondem 404. O teste verifica o que temos, não inventa o resto.
    const { tmdb } = cliente({ ...rotasSerie });
    await expect(tmdb.detalheDeSerie(1396)).rejects.toThrow(ErroTmdb);
  });

  it('com todas as temporadas gravadas, a 0 entra como qualquer outra', async () => {
    const seriePequena = JSON.parse(ler('serie-1396-pt.json'));
    seriePequena.seasons = seriePequena.seasons.filter(
      (s: { season_number: number }) => s.season_number <= 1,
    );
    const { tmdb } = cliente({
      '/tv/1396?pt-PT': JSON.stringify(seriePequena),
      '/tv/1396/season/0?pt-PT': ler('serie-1396-t0-pt.json'),
      '/tv/1396/season/1?pt-PT': ler('serie-1396-t1-pt.json'),
    });
    const d = await tmdb.detalheDeSerie(1396);
    expect(d.temporadas.map((t) => t.numero)).toEqual([0, 1]);
    expect(d.temporadas[0]!.episodios.length).toBeGreaterThan(0);
    expect(d.temporadas[1]!.episodios).toHaveLength(7);
    expect(d.estado).toBe('Ended');
  });
});

describe('erros', () => {
  it('um 404 do TMDB não se repete e não vaza o corpo', async () => {
    const { tmdb, chamadas } = cliente({
      '/movie/999999?pt-PT': {
        estado: 404,
        corpo: '{"status_message":"The resource you requested could not be found."}',
      },
    });
    await expect(tmdb.detalheDeFilme(999999)).rejects.toMatchObject({
      codigo: 'nao_encontrado',
    });
    expect(chamadas).toHaveLength(1);
  });

  it('uma credencial errada não se repete: gastaria quota pelo mesmo erro', async () => {
    const { tmdb, chamadas } = cliente({ '/movie/550?pt-PT': { estado: 401 } });
    await expect(tmdb.detalheDeFilme(550)).rejects.toMatchObject({
      codigo: 'credencial',
    });
    expect(chamadas).toHaveLength(1);
  });

  it('um 429 repete-se, e respeita o Retry-After', async () => {
    const esperas: number[] = [];
    const { buscar } = buscarFalso({
      '/movie/550?pt-PT': { estado: 429, cabecalhos: { 'retry-after': '2' } },
    });
    const tmdb = new ClienteTmdb({
      token: 't',
      buscar,
      relogio: { esperar: async (ms) => void esperas.push(ms), acaso: () => 0.5 },
    });
    await expect(tmdb.detalheDeFilme(550)).rejects.toMatchObject({
      codigo: 'indisponivel',
    });
    expect(esperas).toEqual([2000, 2000]);
  });
});

describe('deduplicação', () => {
  it('dois pedidos ao mesmo recurso fazem uma chamada só', async () => {
    const { tmdb, chamadas } = cliente({ '/movie/550?pt-PT': ler('filme-550-pt.json') });
    const [a, b] = await Promise.all([
      tmdb.detalheDeFilme(550),
      tmdb.detalheDeFilme(550),
    ]);
    expect(a).toEqual(b);
    expect(chamadas).toEqual(['/movie/550?pt-PT']);
  });

  it('recursos diferentes não se deduplicam um ao outro', async () => {
    const { tmdb, chamadas } = cliente({
      '/movie/550?pt-PT': ler('filme-550-pt.json'),
      '/movie/1119878?pt-PT': ler('filme-obscuro-pt.json'),
    });
    await Promise.all([tmdb.detalheDeFilme(550), tmdb.detalheDeFilme(1119878)]);
    expect(chamadas).toHaveLength(2);
  });

  it('um erro não fica preso no deduplicador', async () => {
    const d = new Deduplicador<string>();
    await expect(
      d.uma('x', async () => {
        throw new Error('falhou');
      }),
    ).rejects.toThrow();
    expect(d.emVoo).toBe(0);
    // O pedido seguinte tem direito a tentar. Guardar o erro transformaria uma
    // falha momentânea numa falha permanente para todos os que viessem a seguir.
    expect(await d.uma('x', async () => 'ok')).toBe('ok');
  });
});

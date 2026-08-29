/**
 * F2-6 · Edge Function `search`.
 *
 * Filmes e séries numa lista só. **Não escreve nada** — decisão D1 em
 * docs/plano/fase-2.md: gravar na pesquisa encheria `titles` de vinte linhas
 * por consulta, quase todas de títulos que ninguém vai avaliar.
 *
 * Um resultado é identificado por `(tmdbId, genero)`. O nosso `uuid` só existe
 * depois de alguém abrir o título, e quem o cria é a função `title`.
 *
 * Esta casca não decide nada: lê o ambiente, chama o núcleo e serializa. Tudo o
 * que decide alguma coisa está em `_shared/` e é testado em Vitest sem rede.
 */

import { ClienteTmdb } from '../_shared/cliente.ts';
import { ErroTmdb } from '../_shared/erros.ts';
import {
  corpoJson,
  json,
  preflight,
  respostaDeErro,
  utilizadorAutenticado,
} from '../_shared/http.ts';

const TOKEN = Deno.env.get('TMDB_READ_ACCESS_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const tmdb = new ClienteTmdb({ token: TOKEN });

Deno.serve(async (pedido: Request) => {
  if (pedido.method === 'OPTIONS') return preflight();

  try {
    if (TOKEN === '') {
      // Falhar aqui e não no TMDB: o erro é nosso, e um 401 do upstream por
      // credencial ausente é mais difícil de diagnosticar do que este.
      throw new ErroTmdb('credencial', 'TMDB_READ_ACCESS_TOKEN ausente no ambiente');
    }

    // Exige sessão. Sem isto, a função é uma porta aberta para a nossa quota.
    await utilizadorAutenticado(pedido, SUPABASE_URL, ANON);

    const corpo = await corpoJson(pedido);
    const query = typeof corpo['query'] === 'string' ? corpo['query'] : '';
    const pagina = typeof corpo['pagina'] === 'number' ? corpo['pagina'] : 1;

    const resultados = await tmdb.pesquisar(query, pagina);
    return json({ resultados });
  } catch (erro) {
    // O corpo do TMDB fica no log; o cliente recebe um código da nossa lista.
    if (erro instanceof ErroTmdb && erro.interno !== undefined) {
      console.error(`[search] ${erro.codigo}: ${erro.interno}`);
    } else if (!(erro instanceof ErroTmdb)) {
      console.error('[search] inesperado:', erro);
    }
    return respostaDeErro(erro);
  }
});

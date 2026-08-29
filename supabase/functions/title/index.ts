/**
 * F2-7 · Edge Function `title`.
 *
 * Materializa um título: devolve o detalhe e o nosso `uuid`, que é com o que
 * `buckets` e `rank_positions` trabalham. É a única função que escreve.
 *
 * O caminho normal é o cache. Só se o TTL tiver expirado — ou se o título nunca
 * tiver sido visto — é que se chama o TMDB. Um filme de 1999 revalida de 90 em
 * 90 dias; uma série em emissão, todos os dias.
 *
 * Séries trazem temporadas e episódios completos, **incluindo a temporada 0 dos
 * especiais**, que é uma temporada legítima do produto.
 */

import { emCache, guardar, lerDoCache, type Rest } from '../_shared/cache.ts';
import { ClienteTmdb } from '../_shared/cliente.ts';
import { ErroTmdb } from '../_shared/erros.ts';
import {
  corpoJson,
  genero as validarGenero,
  inteiro,
  json,
  preflight,
  respostaDeErro,
  utilizadorAutenticado,
} from '../_shared/http.ts';

const TOKEN = Deno.env.get('TMDB_READ_ACCESS_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const tmdb = new ClienteTmdb({ token: TOKEN });

// `titles`, `seasons` e `episodes` só aceitam escrita de `service_role`: são
// metadados do TMDB, não dados de utilizador, e ninguém os edita pela app.
const rest: Rest = { url: SUPABASE_URL, chave: SERVICE };

Deno.serve(async (pedido: Request) => {
  if (pedido.method === 'OPTIONS') return preflight();

  try {
    if (TOKEN === '') {
      throw new ErroTmdb('credencial', 'TMDB_READ_ACCESS_TOKEN ausente no ambiente');
    }
    if (SERVICE === '') {
      throw new ErroTmdb('credencial', 'SUPABASE_SERVICE_ROLE_KEY ausente no ambiente');
    }

    await utilizadorAutenticado(pedido, SUPABASE_URL, ANON);

    const corpo = await corpoJson(pedido);
    const genero = validarGenero(corpo['genero']);
    const tmdbId = inteiro(corpo['tmdbId'], 'tmdbId');

    const agora = new Date();
    const cached = await emCache(rest, genero, tmdbId, agora);

    if (cached !== null) {
      const detalhe = await lerDoCache(rest, cached.id);
      if (detalhe !== null) {
        return json({ ...detalhe, id: cached.id, doCache: true });
      }
      // Linha em `titles` sem o resto: cai para o TMDB e regrava. Acontece se
      // uma gravação anterior foi interrompida a meio das temporadas.
    }

    const detalhe = await tmdb.detalhe(genero, tmdbId);
    const id = await guardar(rest, detalhe, agora);

    return json({ ...detalhe, id, doCache: false });
  } catch (erro) {
    if (erro instanceof ErroTmdb && erro.interno !== undefined) {
      console.error(`[title] ${erro.codigo}: ${erro.interno}`);
    } else if (!(erro instanceof ErroTmdb)) {
      console.error('[title] inesperado:', erro);
    }
    return respostaDeErro(erro);
  }
});

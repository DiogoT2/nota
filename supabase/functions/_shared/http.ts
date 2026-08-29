/**
 * O pouco que as duas Edge Functions partilham na fronteira HTTP.
 *
 * Continua sem uma única API do Deno — o `Deno.env` fica no handler, que é a
 * casca. Isto permite testar em Vitest tudo o que decide alguma coisa.
 */

import { corpoDoErro, ErroTmdb, estadoHttp } from './erros.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(corpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export function respostaDeErro(erro: unknown): Response {
  const codigo = erro instanceof ErroTmdb ? erro.codigo : 'upstream';
  return json(corpoDoErro(erro), estadoHttp(codigo));
}

/**
 * Confirma que quem chama tem sessão.
 *
 * Sem isto, a função é uma porta aberta para a nossa quota do TMDB: qualquer
 * pessoa com a URL faria pesquisas à nossa custa. A chave `anon` não chega —
 * ela está no bundle e é pública por desenho.
 *
 * A verificação é feita contra o Auth do Supabase, e não descodificando o JWT
 * aqui: validar uma assinatura à mão é onde se erra.
 */
export async function utilizadorAutenticado(
  pedido: Request,
  supabaseUrl: string,
  anonKey: string,
  buscar: typeof fetch = fetch,
): Promise<string> {
  const cabecalho = pedido.headers.get('Authorization');
  if (cabecalho === null || !cabecalho.startsWith('Bearer ')) {
    throw new ErroTmdb('nao_autenticado', 'sem cabeçalho Authorization');
  }

  const r = await buscar(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: cabecalho, apikey: anonKey },
  });

  if (!r.ok) throw new ErroTmdb('nao_autenticado', `auth ${r.status}`);

  const utilizador = (await r.json()) as { id?: string; role?: string };
  if (typeof utilizador.id !== 'string') {
    throw new ErroTmdb('nao_autenticado', 'resposta do auth sem id');
  }
  // A chave `anon` sozinha resolve para um utilizador sem id; uma sessão real
  // tem `role: authenticated`. É a diferença entre «tem a chave pública» e
  // «tem conta».
  if (utilizador.role !== 'authenticated') {
    throw new ErroTmdb('nao_autenticado', `role ${utilizador.role ?? 'ausente'}`);
  }

  return utilizador.id;
}

/** Lê e valida o corpo de um pedido, sem confiar em nada do que lá vem. */
export async function corpoJson(pedido: Request): Promise<Record<string, unknown>> {
  try {
    const c = await pedido.json();
    if (typeof c !== 'object' || c === null || Array.isArray(c)) {
      throw new ErroTmdb('pedido_invalido', 'corpo não é um objecto');
    }
    return c as Record<string, unknown>;
  } catch (erro) {
    if (erro instanceof ErroTmdb) throw erro;
    throw new ErroTmdb('pedido_invalido', 'corpo ilegível');
  }
}

export function inteiro(v: unknown, campo: string): number {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ErroTmdb('pedido_invalido', `${campo} inválido`);
  }
  return n;
}

export function genero(v: unknown): 'movie' | 'tv' {
  if (v === 'movie' || v === 'tv') return v;
  throw new ErroTmdb('pedido_invalido', 'genero tem de ser movie ou tv');
}

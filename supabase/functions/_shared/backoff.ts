/**
 * F2-4 · Backoff exponencial com jitter.
 *
 * O jitter não é cosmético. Sem ele, N pedidos que falham ao mesmo tempo
 * esperam exactamente o mesmo tempo e voltam a falhar ao mesmo tempo — o
 * backoff sincroniza os clientes em vez de os espalhar, e a carga que causou o
 * 429 repete-se em picos cada vez mais espaçados mas igualmente altos.
 *
 * O relógio e o dado entram por parâmetro para que os testes não esperem
 * segundos reais nem dependam do acaso.
 */

import { ErroTmdb } from './erros.ts';

export type Relogio = {
  readonly esperar: (ms: number) => Promise<void>;
  /** Devolve [0, 1). Injectável para o teste ser determinista. */
  readonly acaso: () => number;
};

export const relogioReal: Relogio = {
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  acaso: () => Math.random(),
};

export type Politica = {
  readonly tentativas: number;
  readonly baseMs: number;
  readonly tectoMs: number;
};

export const politicaPadrao: Politica = {
  // Três tentativas no total. Mais do que isto, num pedido que alguém está a
  // ver acontecer, é fazer a pessoa esperar por uma resposta que já se sabe má.
  tentativas: 3,
  baseMs: 400,
  tectoMs: 8000,
};

/**
 * Espera da tentativa `n` (base 0), com jitter completo.
 *
 * Jitter completo — um valor uniforme entre 0 e o tecto exponencial — em vez de
 * «exponencial mais um bocadinho»: é o que mais espalha os clientes, e é o que
 * a literatura de backoff recomenda quando o objectivo é dessincronizar.
 */
export function espera(n: number, p: Politica, acaso: number): number {
  const tecto = Math.min(p.tectoMs, p.baseMs * 2 ** n);
  return Math.round(acaso * tecto);
}

/** Lê `Retry-After`, em segundos ou como data HTTP. */
export function retryAfter(
  cabecalho: string | null,
  agora: Date = new Date(),
): number | null {
  if (cabecalho === null) return null;
  const segundos = Number.parseInt(cabecalho.trim(), 10);
  if (Number.isFinite(segundos) && segundos >= 0) return segundos * 1000;
  const data = Date.parse(cabecalho);
  if (Number.isNaN(data)) return null;
  return Math.max(0, data - agora.getTime());
}

/**
 * Corre `tentar` até resultar, respeitando `Retry-After` quando o houver.
 *
 * Um erro não repetível sai à primeira: repetir um 401 com a mesma credencial
 * errada dá o mesmo 401 e gasta quota; repetir um 404 não faz o título nascer.
 */
export async function comBackoff<T>(
  tentar: () => Promise<T>,
  {
    politica = politicaPadrao,
    relogio = relogioReal,
    esperaSugerida,
  }: {
    politica?: Politica;
    relogio?: Relogio;
    /** Devolve o `Retry-After` do último erro, se o houver. */
    esperaSugerida?: (erro: unknown) => number | null;
  } = {},
): Promise<T> {
  let ultimo: unknown;

  for (let n = 0; n < politica.tentativas; n += 1) {
    try {
      return await tentar();
    } catch (erro) {
      ultimo = erro;
      if (erro instanceof ErroTmdb && !erro.repetivel) throw erro;
      if (n === politica.tentativas - 1) break;

      const sugerida = esperaSugerida?.(erro) ?? null;
      // O servidor sabe melhor do que nós quando voltar. Quando ele diz, o
      // nosso cálculo não tem nada a acrescentar.
      await relogio.esperar(sugerida ?? espera(n, politica, relogio.acaso()));
    }
  }

  throw ultimo;
}

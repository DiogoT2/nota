/**
 * F2-5 · Erros tipados.
 *
 * Nenhum corpo de erro do TMDB chega ao cliente. Um erro que cita o upstream
 * conta a quem o lê o que está por baixo — a versão da API, o nome do serviço,
 * às vezes a razão exacta pela qual a credencial falhou. O cliente recebe um
 * código de uma lista fechada e nada mais.
 *
 * A distinção que interessa cá dentro, e que o cliente nunca vê: o que é culpa
 * de quem pediu (`nao_encontrado`, `pedido_invalido`) e o que é nossa
 * (`credencial`, `upstream`, `indisponivel`). A primeira família não se repete;
 * a segunda pode valer a pena repetir.
 */

export type CodigoErro =
  /** O recurso não existe no TMDB. Não se repete. */
  | 'nao_encontrado'
  /** Parâmetros que não fazem sentido. Não se repete. */
  | 'pedido_invalido'
  /** Sem sessão, ou sessão inválida. */
  | 'nao_autenticado'
  /** A NOSSA credencial do TMDB está errada ou expirou. Não se repete: repetir
   *  com a mesma chave errada dá o mesmo erro e gasta quota. */
  | 'credencial'
  /** O TMDB respondeu com erro que não é nenhum dos acima. Pode repetir-se. */
  | 'upstream'
  /** Excedemos a quota ou o TMDB está em baixo. Pode repetir-se, com espera. */
  | 'indisponivel';

export class ErroTmdb extends Error {
  readonly codigo: CodigoErro;
  /** Só para o nosso log. Nunca serializado para o cliente. */
  readonly interno: string | undefined;

  constructor(codigo: CodigoErro, interno?: string) {
    super(codigo);
    this.name = 'ErroTmdb';
    this.codigo = codigo;
    this.interno = interno;
  }

  /** Vale a pena tentar outra vez? */
  get repetivel(): boolean {
    return this.codigo === 'upstream' || this.codigo === 'indisponivel';
  }
}

/** Traduz o estado HTTP do TMDB para a nossa lista fechada. */
export function daResposta(estado: number, corpo?: string): ErroTmdb {
  if (estado === 404) return new ErroTmdb('nao_encontrado', corpo);
  if (estado === 401 || estado === 403) return new ErroTmdb('credencial', corpo);
  if (estado === 422 || estado === 400) return new ErroTmdb('pedido_invalido', corpo);
  if (estado === 429 || estado >= 500) return new ErroTmdb('indisponivel', corpo);
  return new ErroTmdb('upstream', `${estado}: ${corpo ?? ''}`);
}

/** Estado HTTP com que respondemos ao nosso cliente. */
export function estadoHttp(codigo: CodigoErro): number {
  switch (codigo) {
    case 'nao_encontrado':
      return 404;
    case 'pedido_invalido':
      return 400;
    case 'nao_autenticado':
      return 401;
    case 'indisponivel':
      return 503;
    // Uma credencial nossa errada é um erro nosso, não de quem pediu. Devolver
    // 401 aqui diria ao cliente que a sessão dele é que está mal, e mandava-o
    // fazer login outra vez sem razão nenhuma.
    case 'credencial':
    case 'upstream':
      return 502;
  }
}

/** O corpo que o cliente recebe. Um código, e mais nada. */
export function corpoDoErro(erro: unknown): { erro: CodigoErro } {
  return { erro: erro instanceof ErroTmdb ? erro.codigo : 'upstream' };
}

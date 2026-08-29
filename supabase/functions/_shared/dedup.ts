/**
 * F2-4 · Deduplicação de pedidos em curso.
 *
 * Dez pessoas a abrir a mesma série ao mesmo tempo devem produzir uma chamada
 * ao TMDB, não dez. Guardamos a promessa em curso, não o resultado: quem chega
 * a meio espera pela que já vai a caminho.
 *
 * Não é um cache. A entrada sai do mapa quando a promessa termina, com sucesso
 * ou sem ele. O cache com duração é o Postgres, e é lá que está a defesa real —
 * este mapa vive num isolate e não sobrevive a um arranque a frio nem cobre
 * várias instâncias. Cobre a rajada, que é o caso que interessa.
 */

export class Deduplicador<T> {
  readonly #emCurso = new Map<string, Promise<T>>();

  async uma(chave: string, produzir: () => Promise<T>): Promise<T> {
    const jaVai = this.#emCurso.get(chave);
    if (jaVai !== undefined) return jaVai;

    // Guardar ANTES de esperar. Se a promessa fosse registada depois do await,
    // dois pedidos no mesmo tick não se veriam um ao outro — que é exactamente
    // o caso que isto existe para resolver.
    const promessa = produzir();
    this.#emCurso.set(chave, promessa);

    try {
      return await promessa;
    } finally {
      // Um erro não fica preso no mapa: o pedido seguinte tem direito a tentar.
      // Guardar o erro seria transformar uma falha momentânea numa falha
      // permanente para todos os que viessem a seguir.
      this.#emCurso.delete(chave);
    }
  }

  /** Quantos pedidos estão em voo. Só para observabilidade e testes. */
  get emVoo(): number {
    return this.#emCurso.size;
  }
}

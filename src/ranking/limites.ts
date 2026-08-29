/**
 * Limites de produto que o motor tem de respeitar.
 *
 * Vivem aqui e não em `src/theme/tokens.ts` porque não são de estilo: são
 * regras. O tema tem um `limit` para a UI os saber desenhar; a verdade é esta.
 */

/** Máximo rígido de comparações por título. Nunca há uma sexta pergunta. */
export const LIMITE_COMPARACOES = 5;

/** A partir de quantos títulos em comum se mostra o taste match. Decisão D3. */
export const SOBREPOSICAO_MINIMA = 10;

/** Tamanho máximo do Círculo. Imposto no motor; aqui é só para a UI saber. */
export const LIMITE_CIRCULO = 30;

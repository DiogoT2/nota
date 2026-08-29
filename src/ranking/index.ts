/**
 * O motor de ranking. Lógica pura: zero React, zero rede, zero Supabase.
 *
 * Ver `docs/plano/fase-3.md` para as decisões de produto que o moldam.
 */

export {
  BALDES,
  BALDE_CHEIO,
  INTERVALO,
  eBalde,
  melhorQue,
  type Balde,
} from './baldes.ts';
export { LIMITE_CIRCULO, LIMITE_COMPARACOES, SOBREPOSICAO_MINIMA } from './limites.ts';
export {
  AMBITO_GLOBAL,
  ambitoDeEpisodios,
  ambitoDeFilmes,
  ambitoDeSeries,
  chave,
  mesmoAmbito,
  type Ambito,
  type Entrada,
} from './ambitos.ts';
export {
  amplitude,
  arredondar,
  derivar,
  derivarAmbito,
  derivarBalde,
  type ComNota,
} from './derivar.ts';
export {
  colocarCom,
  comecar,
  comparacoesNecessarias,
  responder,
  type Estado,
  type Resposta,
} from './comparar.ts';
export { coerente, inserir, mover, renumerar, PASSO, type Item } from './posicoes.ts';
export {
  arrastar,
  avaliar,
  notas,
  responderA,
  type Avaliacao,
  type Passo,
} from './motor.ts';
export { emComum, tasteMatch, type Par, type TasteMatch } from './tasteMatch.ts';

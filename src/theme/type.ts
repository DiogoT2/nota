import type { TextStyle } from 'react-native';
import { color, font } from './tokens';

/**
 * Papéis tipográficos. Um componente escolhe um papel, nunca uma família,
 * um corpo ou um letter-spacing.
 */
export const typography = {
  /** NOTA — o nome da app no topo e no cartão de partilha. */
  wordmark: {
    fontFamily: font.narrow,
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 14 * 0.24,
    textTransform: 'uppercase',
    color: color.inkMax,
  },
  /** "O CÍRCULO", "PASSO 1 DE 2" — etiqueta de secção em caixa alta. */
  eyebrow: {
    fontFamily: font.sansSemi,
    fontWeight: '600',
    fontSize: 9,
    lineHeight: 9,
    letterSpacing: 9 * 0.2,
    textTransform: 'uppercase',
    color: color.inkDim,
  },
  /** Etiqueta de secção com peso display: "MAIOR DISCORDÂNCIA". */
  sectionLabel: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 11 * 0.2,
    textTransform: 'uppercase',
    color: color.inkMax,
  },
  /** Contagem discreta ao lado de um título: "12 ENTRADAS". */
  tally: {
    fontFamily: font.sansMedium,
    fontWeight: '500',
    fontSize: 9,
    lineHeight: 9,
    letterSpacing: 9 * 0.18,
    color: color.inkDim,
  },
  /** "O CÍRCULO", "O MEU RANKING" — cabeçalho de ecrã. */
  screenTitle: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 32,
    lineHeight: 32 * 0.9,
    textTransform: 'uppercase',
    color: color.inkMax,
  },
  /** Título de uma obra em página de detalhe. */
  workTitle: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 27,
    lineHeight: 27 * 0.94,
    textTransform: 'uppercase',
    color: color.inkMax,
  },
  /** Título de uma obra numa entrada de feed. */
  entryTitle: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 19,
    lineHeight: 19,
    textTransform: 'uppercase',
    color: color.inkMax,
  },
  /** Título numa linha de ranking. */
  rowTitle: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 14 * 1.05,
    textTransform: 'uppercase',
    color: color.inkMax,
  },
  /** Os baldes de avaliação. Tipografia display a fazer de botão. */
  bucket: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 40,
    lineHeight: 40 * 0.85,
    textTransform: 'uppercase',
    color: color.inkMax,
  },
  /** Um balde indisponível — "desisti a meio". */
  bucketQuiet: {
    fontFamily: font.narrow,
    fontWeight: '400',
    fontSize: 20,
    lineHeight: 20,
    textTransform: 'uppercase',
    color: color.inkTrace,
  },
  /** Pergunta de comparação. */
  prompt: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 21,
    lineHeight: 21 * 1.1,
    letterSpacing: 21 * 0.02,
    textTransform: 'uppercase',
    color: color.inkMax,
  },
  /** Pergunta em texto corrente ("como é que ficaste?"). */
  question: {
    fontFamily: font.sansBold,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 15 * 1.3,
    color: color.inkMax,
  },
  /** A nota, no feed. */
  score: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 23,
    lineHeight: 23,
    fontVariant: ['tabular-nums'],
    color: color.inkMax,
  },
  /** A nota de outra pessoa, numa lista. */
  scoreSmall: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
    color: color.inkMax,
  },
  /** A minha nota, em destaque no detalhe. Acesa. */
  scoreLarge: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 44,
    lineHeight: 44 * 0.85,
    fontVariant: ['tabular-nums'],
    color: color.ember,
  },
  /** A nota que acabou de ser derivada. O momento do produto. */
  scoreReveal: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 60,
    lineHeight: 60 * 0.8,
    fontVariant: ['tabular-nums'],
    color: color.ember,
  },
  /** Delta de discordância: "Δ 1,4". */
  delta: {
    fontFamily: font.sansSemi,
    fontWeight: '600',
    fontSize: 10,
    lineHeight: 10,
    fontVariant: ['tabular-nums'],
    color: color.inkGhost,
  },
  /** Nome de uma pessoa. */
  person: {
    fontFamily: font.sansSemi,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 12,
    color: color.inkHigh,
  },
  personSmall: {
    fontFamily: font.sansSemi,
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 11,
    color: color.inkMid,
  },
  /** Uma nota escrita — sempre entre aspas, sempre curta. */
  quote: {
    fontFamily: font.sans,
    fontWeight: '400',
    fontSize: 12.5,
    lineHeight: 12.5 * 1.45,
    color: color.inkBody,
  },
  /** Ano, realizador, duração. */
  meta: {
    fontFamily: font.sans,
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 11 * 1.5,
    color: color.inkDim,
  },
  metaTight: {
    fontFamily: font.sans,
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 10,
    color: color.inkMute,
  },
  /** Nota de rodapé explicativa. Explica a regra, não vende. */
  footnote: {
    fontFamily: font.sans,
    fontWeight: '400',
    fontSize: 11.5,
    lineHeight: 11.5 * 1.5,
    color: color.inkFaint,
  },
  footnoteQuiet: {
    fontFamily: font.sans,
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 11 * 1.5,
    color: color.inkGhost,
  },
  /** Botão primário, sobre a brasa. */
  actionPrimary: {
    fontFamily: font.sansBold,
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
    color: color.onEmber,
  },
  /** Botão de contorno: "Responder", "Discordo", "Não sei". */
  actionQuiet: {
    fontFamily: font.sansSemi,
    fontWeight: '600',
    fontSize: 9,
    lineHeight: 9,
    letterSpacing: 9 * 0.14,
    textTransform: 'uppercase',
    color: color.inkSoft,
  },
  /** Separador de navegação inferior. */
  tab: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 10 * 0.18,
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  /** Escrita sobre um poster. */
  posterCaption: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 8,
    lineHeight: 8 * 1.1,
    letterSpacing: 8 * 0.06,
    textTransform: 'uppercase',
    color: color.onPosterSoft,
  },
  /** Nº de posição no ranking. */
  position: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 13,
    fontVariant: ['tabular-nums'],
    color: color.inkGhost,
  },
  /** Rótulo de um episódio no gráfico. */
  episodeTick: {
    fontFamily: font.sansSemi,
    fontWeight: '600',
    fontSize: 8,
    lineHeight: 8,
    color: color.inkMute,
  },
  episodeScore: {
    fontFamily: font.narrowBold,
    fontWeight: '700',
    fontSize: 9,
    lineHeight: 9,
    fontVariant: ['tabular-nums'],
    color: color.inkMid,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeRole = keyof typeof typography;

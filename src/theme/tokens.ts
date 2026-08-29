/**
 * Tokens da direcção visual "Sala Escura" (Claude Design, opção 1a).
 *
 * A metáfora: o ecrã é uma sala às escuras. Uma nota conhecida ACENDE
 * (brasa `ember`); uma nota cega fica APAGADA. Nenhum valor literal de estilo
 * pode existir fora deste ficheiro — ver CLAUDE.md, "Proibições permanentes".
 */

export const color = {
  /** Fundo base — preto quente, não neutro. */
  bgBase: '#0A0806',
  /** Blocos elevados: painel da minha nota, cartões destacados. */
  bgRaised: '#100D0B',
  /** Linhas rebaixadas: entrada em discordância no detalhe. */
  bgSunken: '#0E0A08',
  /** Estado premido / hover. */
  bgPressed: '#140F0C',
  /** Barra de ranking ilegível (perfil visto por um estranho). */
  bgInert: '#151110',
  bgInertDeep: '#131010',

  /** Separador entre entradas. */
  lineHairline: '#1A1512',
  /** Régua de secção, calha das barras de nota. */
  lineRule: '#241D18',
  /** Contorno de botão secundário. */
  lineStrong: '#2E2621',

  /** A brasa. A única cor saturada da app. */
  ember: '#FF4A22',
  /** A brasa premida. */
  emberHot: '#FF6A45',
  /** Etiqueta em brasa apagada — eyebrows, "dá a tua nota". */
  emberMuted: '#8A6355',
  /** Bordo inferior de uma nota por revelar: a brasa que ainda não acendeu. */
  emberEmbers: '#4A1A0C',
  /** Intervalo de discordância sólido (< 1,5). */
  gapNear: '#4E3128',
  /** Intervalo de discordância sólido, mais aberto. */
  gapWide: '#5E3A2E',

  /** Títulos, números acesos. */
  inkMax: '#F4EFE9',
  inkHigh: '#E4DAD3',
  /** Nome de pessoa, marca da nota de outrem. */
  inkMid: '#C4B8AF',
  /** Corpo de texto, citações. */
  inkBody: '#A0938A',
  inkSoft: '#8A7D74',
  inkDim: '#695E56',
  inkFaint: '#5A5049',
  inkGhost: '#4E453F',
  inkMute: '#544B45',
  inkTrace: '#3F3833',
  inkVoid: '#332D29',

  /** O "—,—" de uma nota cega. */
  blindNumber: '#3A312B',
  /** A calha de uma nota cega: mais escura que a calha normal. */
  blindTrack: '#16110E',

  /** Texto sobre um poster. */
  onPoster: 'rgba(255,255,255,0.88)',
  onPosterSoft: 'rgba(255,255,255,0.85)',
  /** Texto sobre a brasa (botão primário). */
  onEmber: '#0A0806',

  transparent: 'transparent',
} as const;

/**
 * Tons de poster enquanto não há imagem do TMDB. Nunca são decorativos:
 * é a única cor do ecrã, por isso vêm de uma paleta fechada.
 */
export const posterTint = {
  slate: '#2B3B57',
  teal: '#1E4A5F',
  clay: '#4A4238',
  graphite: '#2A2E3C',
  moss: '#3A4A2E',
  amber: '#4A3B2A',
  ice: '#1C3A4A',
  bark: '#3A2E28',
  rust: '#4A3226',
  ash: '#2A2A2A',
  ember: '#5C2E22',
  sand: '#6B4A2A',
  violet: '#3E3A46',
  avatar: '#241D18',
} as const;

export type PosterTint = (typeof posterTint)[keyof typeof posterTint];

/** Escala de 2px. Nenhum padding ou gap fora daqui. */
export const space = {
  none: 0,
  hair: 2,
  s4: 4,
  s6: 6,
  s8: 8,
  s10: 10,
  s12: 12,
  s14: 14,
  s16: 16,
  s18: 18,
  s20: 20,
  s22: 22,
  s26: 26,
  s28: 28,
  s30: 30,
  s34: 34,
  s40: 40,
  s56: 56,
  s80: 80,
} as const;

export const border = {
  hairline: 1,
  /** O corte de luz: 2px. Marca de autoria, de Círculo e de separador forte. */
  cut: 2,
  block: 6,
} as const;

export const font = {
  /** Interface, corpo, números pequenos. */
  sans: 'Archivo_400Regular',
  sansMedium: 'Archivo_500Medium',
  sansSemi: 'Archivo_600SemiBold',
  sansBold: 'Archivo_700Bold',
  sansBlack: 'Archivo_800ExtraBold',
  /** Display: títulos, notas, wordmark. Condensada — cabe o título todo. */
  narrow: 'ArchivoNarrow_400Regular',
  narrowSemi: 'ArchivoNarrow_600SemiBold',
  narrowBold: 'ArchivoNarrow_700Bold',
} as const;

/** Alturas dos elementos que carregam o significado do produto. */
export const size = {
  /** Feixe de nota no feed. */
  beam: 6,
  /** Feixe de nota no detalhe e na confirmação. */
  beamLarge: 10,
  /** Feixe do cartão de partilha, à escala do cartaz. */
  beamPoster: 30,
  /** Barra fina sob uma linha de ranking. */
  beamThin: 4,
  /** Faixa de discordância. */
  gapTrack: 14,
  /** A minha marca na faixa de discordância. */
  markMine: 12,
  /** A marca da outra pessoa. */
  markTheirs: 8,
  /** Deslocamento vertical das marcas dentro da faixa de discordância. */
  markMineTop: 1,
  markTheirsTop: 3,
  /** O corte de luz que assina uma entrada. */
  authorCut: 12,
  /** Passo do gráfico de episódios: 1 ponto de nota = 10px de barra. */
  episodeUnit: 10,
  episodeChart: 150,
  /** Divisões da calha do feixe: uma por ponto inteiro. */
  beamTicks: 10,
  /** Cartão de Stories. */
  storyWidth: 1080,
  storyHeight: 1920,
} as const;

/** O acender. Só a brasa emite luz; mais nada no ecrã tem sombra. */
export const glow = {
  beam: {
    shadowColor: color.ember,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  beamLarge: {
    shadowColor: color.ember,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  mark: {
    shadowColor: color.ember,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  numberSmall: {
    textShadowColor: 'rgba(255,74,34,0.45)',
    textShadowRadius: 24,
    textShadowOffset: { width: 0, height: 0 },
  },
  numberLarge: {
    textShadowColor: 'rgba(255,74,34,0.5)',
    textShadowRadius: 30,
    textShadowOffset: { width: 0, height: 0 },
  },
} as const;

export const opacity = {
  dragging: 0.4,
  pressed: 0.82,
  circleAverage: 0.75,
  rankBar: 0.9,
} as const;

/**
 * Geometria do poster. Proporção 2:3 em todo o lado; o que muda é a escala a
 * que ele aparece, e se ainda cabe o título por cima.
 */
export const poster = {
  entry: { width: 56, height: 84, pad: 6, caption: true },
  row: { width: 30, height: 46, pad: 0, caption: false },
  detail: { width: 104, height: 156, pad: 8, caption: true },
  rate: { width: 70, height: 106, pad: 6, caption: true },
  /** Fluidos: a largura vem do contentor, a altura da proporção. */
  grid: { width: undefined, height: undefined, pad: 4, caption: true },
  choice: { width: undefined, height: undefined, pad: 10, caption: true },
  ratio: 2 / 3,
} as const;

/** Medidas de composição que aparecem em mais do que um ecrã. */
export const metric = {
  /** Coluna do delta, para que os "Δ" alinhem entre linhas. */
  deltaColumn: 44,
  /** Coluna do número de posição no ranking. */
  positionColumn: 20,
  /** As três linhas da pega de arrasto. */
  gripLine: 13,
  hairLine: 1,
  avatar: 56,
  /** Barra de ranking ilegível no perfil de um estranho. */
  inertBar: 11,
  /** Legenda "média das tuas notas", em duas linhas. */
  legendColumn: 80,
  legendMark: 10,
  /** O "OU" entre os dois lados de uma comparação. */
  choiceDivider: 36,
  /** Traço de progresso da sequência de comparação. */
  progressTick: 3,
  /** Largura de leitura confortável para uma nota de rodapé. */
  measureShort: 260,
  measure: 280,
} as const;

/**
 * O cartão de Stories, em coordenadas de 1080×1920. O ecrã desenha-o a uma
 * escala qualquer; as proporções são estas e não mudam.
 */
export const story = {
  padX: 90,
  padY: 110,
  rule: 6,
  wordmark: 42,
  date: 26,
  posterWidth: 600,
  posterHeight: 900,
  posterCaption: 46,
  posterPad: 40,
  title: 88,
  score: 190,
  beam: 30,
  footLabel: 30,
  footName: 52,
  handle: 26,
  gapPoster: 90,
  gapTitle: 70,
  gapScore: 52,
  gapFoot: 34,
  gapName: 16,
  gapNumber: 36,
} as const;

/** Limites de produto que a UI tem de saber desenhar. Ver CLAUDE.md. */
export const limit = {
  /** Nº máximo de comparações de uma sequência de avaliação. */
  comparisons: 5,
  /** Tamanho máximo do Círculo. */
  circle: 30,
  /** Comprimento máximo de uma resposta. */
  replyChars: 140,
  /** Discordância a partir da qual o intervalo passa a tramado. */
  disagreementHatch: 1.5,
  /** Posters no Top do perfil. */
  topTitles: 4,
} as const;

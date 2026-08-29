/**
 * pt-PT é a língua de origem. O tipo `Dictionary` é derivado deste ficheiro,
 * por isso qualquer chave nova falha a compilação em `en` até ser traduzida.
 */
export const ptPT = {
  brand: {
    name: 'Nota',
    handle: 'nota.app/{{handle}}',
  },
  tabs: {
    circle: 'Círculo',
    search: 'Procurar',
    ranking: 'Ranking',
    me: 'Eu',
  },
  common: {
    back: '← {{destination}}',
    or: 'ou',
    delta: 'Δ {{value}}',
    blindScore: '—,—',
    noScore: '—',
    seasonShort: 'T{{number}}',
    episodeShort: 'E{{number}}',
  },
  feed: {
    title: 'O Círculo',
    entries: '{{count}} entradas',
    blindPrompt: 'Dá a tua nota para veres a dele',
    blindPromptFeminine: 'Dá a tua nota para veres a dela',
    endTitle: 'Fim',
    endBody:
      'Viste tudo o que as {{count}} pessoas do teu Círculo publicaram. Não há mais nada por baixo.',
  },
  title: {
    myScore: 'A minha nota',
    derivedFrom: 'Derivada de {{count}} comparações. Toca para reordenar.',
    rankPosition: '#{{position}} no teu ranking',
    circle: 'O Círculo',
    sortedByDistance: 'Por distância à minha',
    reply: 'Responder',
    disagree: 'Discordo',
    replyLimit: 'Respostas até {{count}} caracteres. Sem fios de comentários.',
  },
  series: {
    seasons: '{{count}} temporadas',
    averageOfMyScores: 'Média das tuas notas',
    season: 'Temporada {{number}}',
    legendMine: 'Eu',
    legendCircle: 'Círculo',
    unseenHidden: '{{count}} episódios que ainda não viste, ocultos',
    unseenVisible: '{{count}} episódios que ainda não viste, visíveis',
    show: 'Mostrar',
    hide: 'Ocultar',
    biggestDisagreement: 'Maior discordância da temporada',
  },
  rate: {
    stepOf: 'Passo {{current}} de {{total}}',
    exit: 'Sair',
    bucketQuestion: 'Antes de veres seja o que for: como é que ficaste?',
    bucketLoved: 'Adorei',
    bucketLovedHint: 'ficou comigo dias',
    bucketLiked: 'Gostei',
    bucketLikedHint: 'valeu bem a pena',
    bucketMeh: 'Nah',
    bucketMehHint: 'não foi para mim',
    bucketAbandoned: 'Desisti a meio',
    bucketFootnote:
      'O balde define o intervalo. As comparações definem o número — que tu nunca escreves.',
    bucketChosen: '{{bucket}} → a seguir, {{count}} comparações dentro deste balde.',
    progress: '{{current}} de {{total}}',
    compareQuestion: 'De qual gostaste mais?',
    skip: 'Não sei',
    compareFootnote: 'Cada resposta corta metade da lista. Nunca são mais de {{count}}.',
    placedLabel: 'Encaixado',
    placedBody:
      'Entrou em #{{position}} de {{total}}, entre {{above}} e {{below}}. Ficaram visíveis {{revealed}} notas do teu Círculo.',
    seeDisagreement: 'Ver quem discorda',
    restart: 'Repetir a sequência',
  },
  profile: {
    viewedByStranger: 'Visto por um estranho',
    viewedByFollower: 'Visto por um seguidor',
    viewedByCircle: 'Visto por alguém do Círculo',
    follow: 'Seguir',
    requested: 'Pedido enviado',
    top: 'Top {{count}}',
    personalRanking: 'Ranking pessoal',
    rankingClosed: 'O ranking de {{name}} abre para quem {{pronoun}} segue de volta.',
    pronounShe: 'ela',
    pronounHe: 'ele',
    pronounThey: 'elu',
    whereYouDisagree: 'Onde discordam',
    circleFootnote:
      'Também vês as notas episódio a episódio e podes responder em {{count}} caracteres.',
  },
  pending: {
    label: 'Ainda não',
    search:
      'A pesquisa entra na fase 2: o TMDB é consultado no servidor, com cache, e nunca a partir daqui.',
  },
  me: {
    heading: 'Eu',
    seeProfileAs: 'Ver o meu perfil como',
    asStranger: 'Um estranho',
    asFollower: 'Um seguidor',
    asCircle: 'Alguém do Círculo',
    shareCard: 'Cartão de partilha',
  },
  ranking: {
    titles: '{{count}} títulos',
    heading: 'O meu ranking',
    instructions:
      'Arrasta para corrigir. Cada arrasto reescreve as notas à volta — o número segue a ordem, não o contrário.',
    filters: 'Mostrar apenas: filmes · séries · {{year}} · vistos com o Círculo',
  },
  placeholder: {
    building: 'Em construção. Ver docs/plano/fase-0-1.md.',
  },
  tmdb: {
    attribution:
      'Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.',
    dataFrom: 'Dados de filmes e séries: TMDB',
  },
  share: {
    rankedBy: '#{{position}} no ranking de',
  },
} as const;

/** Alarga os literais para `string`: as traduções não têm de repetir o texto. */
type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof ptPT>;

/**
 * Dados de demonstração — os mesmos do Claude Design.
 *
 * TEMPORÁRIO. Nada disto sobrevive à fase 1: quando o esquema e as políticas
 * RLS fecharem, cada um destes objectos passa a vir do Postgres via TanStack
 * Query, e a visibilidade deixa de ser uma propriedade do ficheiro para ser
 * uma propriedade da linha. Em particular, `score: null` aqui é uma decisão
 * de fixture; em produção é o RLS que não devolve a linha.
 */
import { posterTint, type PosterTint } from '@/theme';
import type { CircleScore, EpisodeMark, FeedItem } from '@/components';

export const feed: readonly FeedItem[] = [
  {
    id: 'aftersun',
    author: 'Rita Salgueiro',
    authorPronoun: 'she',
    when: 'há 2 h',
    title: 'Aftersun',
    qualifier: '2022',
    tint: posterTint.teal,
    score: 9.1,
    note: '“Vi outra vez num avião. Chorei outra vez, com meia cabine a dormir.”',
  },
  {
    id: 'the-bear-s3e6',
    author: 'Tomás Vasconcelos',
    authorPronoun: 'he',
    when: 'há 5 h',
    title: 'The Bear',
    qualifier: 'T3 · E6',
    tint: posterTint.ember,
    score: null,
    note: '“Episódio de encher chouriços. Já vimos esta discussão três vezes.”',
  },
  {
    id: 'zona-de-interesse',
    author: 'Inês Bettencourt',
    authorPronoun: 'she',
    when: 'ontem',
    title: 'Zona de Interesse',
    qualifier: '2023',
    tint: posterTint.moss,
    score: 8.7,
    note: '“Nunca mostra nada e mostra tudo. O desenho de som é o filme.”',
  },
  {
    id: 'dune-2',
    author: 'Miguel Aleixo',
    authorPronoun: 'he',
    when: 'ontem',
    title: 'Dune: Parte Dois',
    qualifier: '2024',
    tint: posterTint.sand,
    score: 6.4,
    note: '“Enorme e oco. Saí a lembrar-me de planos, não de pessoas.”',
  },
  {
    id: 'vidas-passadas',
    author: 'Joana Rebelo',
    authorPronoun: 'she',
    when: 'terça',
    title: 'Vidas Passadas',
    qualifier: '2023',
    tint: posterTint.slate,
    score: null,
    note: '“Primeiro do meu ranking desde 2023 e não me apetece discutir.”',
  },
];

export const circleSize = 12;

export const titleDetail = {
  title: 'Anatomia de uma Queda',
  meta: '2023 · Justine Triet · 151 min',
  tint: posterTint.amber,
  myScore: 8.6,
  comparisons: 9,
  rankPosition: 7,
  rankTotal: 214,
  above: 'Zona de Interesse',
  below: 'Perfect Days',
  revealedAfterRating: 6,
} as const;

export const titleCircle: readonly CircleScore[] = [
  {
    id: 'ines',
    person: 'Inês Bettencourt',
    score: 8.4,
    note: '“O cão é a melhor personagem e não estou a brincar.”',
  },
  {
    id: 'duarte',
    person: 'Duarte Pimenta',
    score: 7.9,
    note: '“Duas horas e meia e nunca olhei para as horas. O miúdo salva o filme.”',
  },
  { id: 'rita', person: 'Rita Salgueiro', score: 7.2, note: '“Admiro-o mais do que gostei dele.”' },
  {
    id: 'miguel',
    person: 'Miguel Aleixo',
    score: 5.1,
    note: '“Um julgamento filmado. Falta-lhe sangue. Preparado para levar porrada.”',
  },
];

export const seriesDetail = {
  title: 'Severance',
  meta: '2022– · Apple TV+',
  seasons: 2,
  selectedSeason: 2,
  tint: posterTint.ice,
  average: 8.5,
  disagreement: {
    episode: 5,
    person: 'Miguel Aleixo',
    theirs: 9.2,
    mine: 7.4,
    note: '“O episódio da cabra. Ou entras ou não entras — eu entrei.”',
  },
} as const;

export const seasonEpisodes: readonly EpisodeMark[] = [
  { number: 1, mine: 8.2, circle: 7.6 },
  { number: 2, mine: 7.9, circle: 7.4 },
  { number: 3, mine: 9.0, circle: 8.1 },
  { number: 4, mine: 8.6, circle: 8.4 },
  { number: 5, mine: 7.4, circle: 7.9 },
  { number: 6, mine: 9.4, circle: 8.8 },
  { number: 7, mine: 8.8, circle: 8.2 },
  { number: 8, mine: null, circle: 7.9 },
  { number: 9, mine: null, circle: 8.3 },
  { number: 10, mine: null, circle: 8.6 },
];

export type Contender = {
  readonly id: string;
  readonly title: string;
  readonly tint: PosterTint;
  readonly meta: string;
};

export const contenders: readonly Contender[] = [
  { id: 'aftersun', title: 'Aftersun', tint: posterTint.teal, meta: '2022 · 9,1' },
  { id: 'vidas-passadas', title: 'Vidas Passadas', tint: posterTint.slate, meta: '2023 · 9,5' },
  { id: 'zona-de-interesse', title: 'Zona de Interesse', tint: posterTint.moss, meta: '2023 · 8,8' },
  { id: 'perfect-days', title: 'Perfect Days', tint: posterTint.clay, meta: '2023 · 9,0' },
  { id: 'drive-my-car', title: 'Drive My Car', tint: posterTint.violet, meta: '2021 · 8,7' },
];

export type RankedTitle = {
  readonly id: string;
  readonly title: string;
  readonly tint: PosterTint;
};

export const ranking: readonly RankedTitle[] = [
  { id: 'vidas-passadas', title: 'Vidas Passadas', tint: posterTint.slate },
  { id: 'aftersun', title: 'Aftersun', tint: posterTint.teal },
  { id: 'perfect-days', title: 'Perfect Days', tint: posterTint.clay },
  { id: 'succession', title: 'Succession', tint: posterTint.graphite },
  { id: 'zona-de-interesse', title: 'Zona de Interesse', tint: posterTint.moss },
  { id: 'anatomia', title: 'Anatomia de uma Queda', tint: posterTint.amber },
  { id: 'severance', title: 'Severance', tint: posterTint.ice },
  { id: 'andor', title: 'Andor', tint: posterTint.bark },
  { id: 'shogun', title: 'Shogun', tint: posterTint.rust },
  { id: 'ripley', title: 'Ripley', tint: posterTint.ash },
];

export const rankingTotal = 214;

export const profile = {
  name: 'Rita Salgueiro',
  handle: 'ritasalgueiro',
  initials: 'RS',
  place: 'Porto',
  pronoun: 'she',
  bio: 'Vejo tudo tarde e mudo de ideias a meio.',
  top: [
    { id: 'vidas-passadas', title: 'Vidas Passadas', tint: posterTint.slate },
    { id: 'aftersun', title: 'Aftersun', tint: posterTint.teal },
    { id: 'perfect-days', title: 'Perfect Days', tint: posterTint.clay },
    { id: 'succession', title: 'Succession', tint: posterTint.graphite },
  ],
  disagreements: [
    { id: 'dune-2', title: 'Dune: Parte Dois', theirs: 8.9, mine: 6.4 },
    { id: 'the-bear', title: 'The Bear · T3', theirs: 5.8, mine: 7.9 },
  ],
} as const;

export const shareCard = {
  title: 'Aftersun',
  year: '2022',
  tint: posterTint.teal,
  score: 9.1,
  position: 2,
  person: 'Rita Salgueiro',
  handle: 'rita',
  date: '27.08.26',
} as const;

export const feedDate = 'QUI 27 AGO';

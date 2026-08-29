import { View } from 'react-native';
import { border, color, limit, metric, space } from '@/theme';
import { useI18n } from '@/i18n';
import { AuthorCut } from './AuthorCut';
import { DisagreementTrack } from './DisagreementTrack';
import { Text } from './Text';

export type CircleScore = {
  readonly id: string;
  readonly person: string;
  readonly score: number;
  readonly note: string | null;
};

/**
 * Uma nota do Círculo para um título, com a discordância desenhada por baixo.
 * A lista que a contém vem sempre ordenada por distância à minha nota.
 */
export function CircleScoreRow({
  entry,
  mine,
  children,
}: {
  readonly entry: CircleScore;
  readonly mine: number;
  readonly children?: React.ReactNode;
}) {
  const { t, formatScore } = useI18n();
  const distance = Math.abs(mine - entry.score);
  const loud = distance > limit.disagreementHatch;

  return (
    <View
      style={{
        paddingHorizontal: space.s20,
        paddingVertical: space.s12,
        borderTopWidth: border.hairline,
        borderTopColor: color.lineHairline,
        backgroundColor: loud ? color.bgSunken : color.transparent,
        gap: space.s8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s8 }}>
        <AuthorCut />
        <Text role="person" style={{ flex: 1 }}>
          {entry.person}
        </Text>
        <Text role="scoreSmall">{formatScore(entry.score)}</Text>
        <Text role="delta" tone={loud ? color.ember : color.inkGhost} style={{ width: metric.deltaColumn, textAlign: 'right' }}>
          {t('common.delta', { value: formatScore(distance) })}
        </Text>
      </View>
      <DisagreementTrack mine={mine} theirs={entry.score} />
      {entry.note === null ? null : <Text role="quote">{entry.note}</Text>}
      {children}
    </View>
  );
}

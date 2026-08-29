import { Pressable, View } from 'react-native';
import { color, glow, space } from '@/theme';
import { useI18n } from '@/i18n';
import { Beam, type BeamScale } from './Beam';
import { Text } from './Text';

export type ScoreLineProps = {
  /** `null` enquanto a nota estiver cega. Regra 1: ninguém vê antes de dar a sua. */
  readonly score: number | null;
  readonly scale?: BeamScale;
  readonly cutColor?: string;
  /** Acende o número em brasa (a MINHA nota), em vez de marfim (a de outrem). */
  readonly mine?: boolean;
  readonly onPress?: (() => void) | undefined;
  readonly accessibilityLabel?: string | undefined;
};

const numberRole = { feed: 'score', detail: 'scoreLarge', poster: 'scoreReveal' } as const;
const numberGlow = { feed: undefined, detail: glow.numberSmall, poster: glow.numberLarge } as const;

/** O número e o feixe, lado a lado. Aceso ou apagado — nunca meio-termo. */
export function ScoreLine({
  score,
  scale = 'feed',
  cutColor = color.bgBase,
  mine = false,
  onPress,
  accessibilityLabel,
}: ScoreLineProps) {
  const { t, formatScore } = useI18n();
  const revealed = score !== null;

  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s10 }}>
      <Text
        role={revealed ? numberRole[scale] : 'score'}
        tone={revealed ? (mine ? color.ember : color.inkMax) : color.blindNumber}
        style={revealed && mine ? numberGlow[scale] : undefined}
      >
        {revealed ? formatScore(score) : t('common.blindScore')}
      </Text>
      <Beam score={score} scale={scale} cutColor={cutColor} />
    </View>
  );

  if (onPress === undefined) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? ''}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      {body}
    </Pressable>
  );
}

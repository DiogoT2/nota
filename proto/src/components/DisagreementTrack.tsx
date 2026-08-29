import { View } from 'react-native';
import { border, color, glow, limit, size, space } from '@/theme';

export type DisagreementTrackProps = {
  /** A minha nota, 0–10. O traço aceso. */
  readonly mine: number;
  /** A nota da outra pessoa, 0–10. O traço marfim. */
  readonly theirs: number;
};

const asPercent = (score: number): `${number}%` => `${(score / size.beamTicks) * 100}%`;

/**
 * A discordância inteira num só elemento: os dois traços e o intervalo entre
 * eles. Sólido até {@link limit.disagreementHatch}; tramado a partir daí — é o
 * mesmo salto que dispara a notificação de discordância no Círculo.
 */
export function DisagreementTrack({ mine, theirs }: DisagreementTrackProps) {
  const distance = Math.abs(mine - theirs);
  const hatched = distance > limit.disagreementHatch;
  const low = Math.min(mine, theirs);
  const high = Math.max(mine, theirs);
  const dashes = hatched ? Math.max(1, Math.round(distance * 4)) : 0;

  return (
    <View style={{ position: 'relative', height: size.gapTrack }}>
      <View
        style={{
          position: 'absolute',
          top: hatched ? space.s4 : space.s6,
          left: asPercent(low),
          right: `${100 - (high / size.beamTicks) * 100}%`,
          height: hatched ? space.s4 : border.cut,
          flexDirection: 'row',
          gap: hatched ? border.cut : 0,
          overflow: 'hidden',
          backgroundColor: hatched
            ? color.transparent
            : distance > limit.disagreementHatch / 2
              ? color.gapWide
              : color.gapNear,
        }}
      >
        {hatched
          ? Array.from({ length: dashes }, (_, index) => (
              <View key={index} style={{ flex: 1, backgroundColor: color.ember }} />
            ))
          : null}
      </View>
      <View
        style={[
          {
            position: 'absolute',
            top: size.markMineTop,
            left: asPercent(mine),
            width: border.cut,
            height: size.markMine,
            backgroundColor: color.ember,
          },
          glow.mark,
        ]}
      />
      <View
        style={{
          position: 'absolute',
          top: size.markTheirsTop,
          left: asPercent(theirs),
          width: border.cut,
          height: size.markTheirs,
          backgroundColor: color.inkMid,
        }}
      />
    </View>
  );
}

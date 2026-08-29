import { View } from 'react-native';
import { color, glow, size } from '@/theme';

export type BeamScale = 'feed' | 'detail' | 'poster';

const beamHeight = { feed: size.beam, detail: size.beamLarge, poster: size.beamPoster } as const;
const beamGlow = { feed: glow.beam, detail: glow.beamLarge, poster: glow.beamLarge } as const;
const tickWidth = { feed: 2, detail: 2, poster: 6 } as const;

export type BeamProps = {
  /** Nota 0–10. `null` = por revelar: o feixe não acende. */
  readonly score: number | null;
  readonly scale?: BeamScale;
  /**
   * A cor do fundo onde o feixe assenta. As divisões da calha são recortes
   * desse fundo, por isso têm de o conhecer.
   */
  readonly cutColor?: string;
};

/**
 * O feixe. Uma calha dividida em dez, preenchida até à nota, a arder.
 * É o mesmo objecto em toda a app — no feed, no detalhe e no cartaz.
 */
export function Beam({ score, scale = 'feed', cutColor = color.bgBase }: BeamProps) {
  const lit = score !== null;
  const ticks = Array.from({ length: size.beamTicks - 1 }, (_, index) => index + 1);

  return (
    <View
      style={{
        position: 'relative',
        flex: 1,
        height: beamHeight[scale],
        backgroundColor: lit ? color.lineRule : color.blindTrack,
        borderBottomWidth: lit ? 0 : 1,
        borderBottomColor: color.emberEmbers,
      }}
    >
      {lit ? (
        <View
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: `${(score / size.beamTicks) * 100}%`,
              backgroundColor: color.ember,
            },
            beamGlow[scale],
          ]}
        />
      ) : null}
      {ticks.map((tick) => (
        <View
          key={tick}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${tick * size.beamTicks}%`,
            marginLeft: -tickWidth[scale],
            width: tickWidth[scale],
            backgroundColor: cutColor,
          }}
        />
      ))}
    </View>
  );
}

import { View } from 'react-native';
import { border, color, glow, size, space } from '@/theme';
import { useI18n } from '@/i18n';
import { Text } from './Text';

export type EpisodeMark = {
  readonly number: number;
  /** A minha nota. `null` = ainda não vi. */
  readonly mine: number | null;
  /** A média do Círculo para este episódio. */
  readonly circle: number;
};

/**
 * Episódio a episódio. A minha nota é a barra acesa; a média do Círculo é o
 * fio marfim que a atravessa. Um episódio por ver é só o contorno — está lá,
 * não brilha.
 */
export function EpisodeChart({ episodes }: { readonly episodes: readonly EpisodeMark[] }) {
  const { t, formatScore } = useI18n();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.s6, height: size.episodeChart }}>
      {episodes.map((episode) => {
        const seen = episode.mine !== null;
        return (
          <View key={episode.number} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: episode.circle * size.episodeUnit,
                height: border.hairline,
                backgroundColor: color.inkMid,
                opacity: 0.75,
              }}
            />
            <View
              style={[
                {
                  height: seen ? episode.mine * size.episodeUnit : space.s6,
                  backgroundColor: seen ? color.ember : color.transparent,
                  borderWidth: seen ? 0 : border.hairline,
                  borderStyle: 'dashed',
                  borderColor: color.lineRule,
                },
                seen ? glow.beam : null,
              ]}
            />
            <Text role="episodeTick" style={{ marginTop: space.s6, textAlign: 'center' }}>
              {t('common.episodeShort', { number: episode.number })}
            </Text>
            <Text
              role="episodeScore"
              tone={seen ? color.inkMid : color.inkTrace}
              style={{ marginTop: space.s4, textAlign: 'center' }}
            >
              {seen ? formatScore(episode.mine) : t('common.noScore')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

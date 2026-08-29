import { View, useWindowDimensions } from 'react-native';
import { border, color, font, glow, size, story } from '@/theme';
import { useI18n } from '@/i18n';
import { Beam, Screen, Text } from '@/components';
import { shareCard } from '@/data/fixtures';

/**
 * Cartão para Stories, 1080×1920. O mesmo feixe, à escala do cartaz.
 * Três coisas e mais nada: o poster, o número aceso, e de quem é.
 *
 * A composição está em coordenadas de 1080 e é multiplicada por `u` para caber
 * no ecrã — é a mesma imagem que sai para exportação, sem um segundo desenho.
 */
export default function ShareCardScreen() {
  const { t, formatScore } = useI18n();
  const { width } = useWindowDimensions();
  const u = width / size.storyWidth;

  return (
    <Screen scroll={false} style={{ justifyContent: 'center' }}>
      <View
        style={{
          width: size.storyWidth * u,
          height: size.storyHeight * u,
          backgroundColor: color.bgBase,
          paddingHorizontal: story.padX * u,
          paddingVertical: story.padY * u,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderBottomWidth: story.rule * u,
            borderBottomColor: color.ember,
            paddingBottom: story.gapFoot * u,
          }}
        >
          <Text
            role="wordmark"
            style={{
              fontSize: story.wordmark * u,
              lineHeight: story.wordmark * u,
              letterSpacing: story.wordmark * u * 0.26,
            }}
          >
            {t('brand.name')}
          </Text>
          <Text
            role="tally"
            style={{
              fontSize: story.date * u,
              lineHeight: story.date * u,
              letterSpacing: story.date * u * 0.2,
            }}
          >
            {shareCard.date}
          </Text>
        </View>

        <View
          style={{
            marginTop: story.gapPoster * u,
            alignSelf: 'center',
            width: story.posterWidth * u,
            height: story.posterHeight * u,
            backgroundColor: shareCard.tint,
            padding: story.posterPad * u,
            justifyContent: 'flex-end',
          }}
        >
          <Text
            role="posterCaption"
            tone={color.onPoster}
            style={{
              fontSize: story.posterCaption * u,
              lineHeight: story.posterCaption * u * 1.05,
              letterSpacing: story.posterCaption * u * 0.05,
            }}
          >
            {shareCard.title}
          </Text>
        </View>

        <Text
          role="screenTitle"
          style={{ marginTop: story.gapTitle * u, fontSize: story.title * u, lineHeight: story.title * u * 0.9 }}
        >
          {shareCard.title}{' '}
          <Text
            role="screenTitle"
            tone={color.inkMute}
            style={{ fontFamily: font.narrow, fontSize: story.title * u, lineHeight: story.title * u * 0.9 }}
          >
            {shareCard.year}
          </Text>
        </Text>

        <View
          style={{
            marginTop: story.gapScore * u,
            flexDirection: 'row',
            alignItems: 'center',
            gap: story.gapNumber * u,
          }}
        >
          <Text
            role="scoreReveal"
            style={[
              { fontSize: story.score * u, lineHeight: story.score * u * 0.75 },
              glow.numberLarge,
            ]}
          >
            {formatScore(shareCard.score)}
          </Text>
          <View style={{ flex: 1, height: story.beam * u }}>
            <Beam score={shareCard.score} scale="poster" />
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            borderTopWidth: border.cut,
            borderTopColor: color.lineRule,
            paddingTop: story.gapFoot * u,
          }}
        >
          <View>
            <Text
              role="eyebrow"
              tone={color.emberMuted}
              style={{
                fontSize: story.footLabel * u,
                lineHeight: story.footLabel * u,
                letterSpacing: story.footLabel * u * 0.16,
              }}
            >
              {t('share.rankedBy', { position: shareCard.position })}
            </Text>
            <Text
              role="screenTitle"
              style={{
                marginTop: story.gapName * u,
                fontSize: story.footName * u,
                lineHeight: story.footName * u,
              }}
            >
              {shareCard.person}
            </Text>
          </View>
          <Text
            role="tally"
            tone={color.inkGhost}
            style={{
              fontSize: story.handle * u,
              lineHeight: story.handle * u,
              letterSpacing: story.handle * u * 0.14,
            }}
          >
            {t('brand.handle', { handle: shareCard.handle })}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

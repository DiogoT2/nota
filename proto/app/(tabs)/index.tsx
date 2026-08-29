import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { color, metric, space } from '@/theme';
import { useI18n } from '@/i18n';
import { FeedEntry, Gutter, Masthead, Rule, Screen, Text } from '@/components';
import { circleSize, feed, feedDate } from '@/data/fixtures';

/**
 * O feed. Só o Círculo, cronológico, e ACABA — não há scroll infinito
 * (CLAUDE.md, proibições permanentes). O fim é um elemento desenhado, não a
 * ausência de mais conteúdo.
 */
export default function FeedScreen() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <Screen>
      <Masthead tally={feedDate} />

      <Gutter
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: space.s8,
          paddingTop: space.s18,
          paddingBottom: space.s12,
        }}
      >
        <Text role="screenTitle">{t('feed.title')}</Text>
        <Text role="tally">{t('feed.entries', { count: feed.length }).toUpperCase()}</Text>
      </Gutter>

      {feed.map((item) => (
        <FeedEntry
          key={item.id}
          item={item}
          onOpen={() => router.push('/titulo/anatomia')}
          onRate={() => router.push('/avaliar/balde')}
        />
      ))}

      <View style={{ paddingTop: space.s28 }}>
        <Rule weight="rule" />
        <Gutter style={{ paddingTop: space.s28, paddingBottom: space.s34 }}>
          <Text role="sectionLabel" tone={color.inkDim}>
            {t('feed.endTitle')}
          </Text>
          <Text role="footnote" tone={color.inkGhost} style={{ marginTop: space.s8, maxWidth: metric.measureShort }}>
            {t('feed.endBody', { count: circleSize })}
          </Text>
        </Gutter>
      </View>
    </Screen>
  );
}

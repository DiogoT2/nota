import { Pressable, View } from 'react-native';
import { border, color, space, type PosterTint } from '@/theme';
import { useI18n } from '@/i18n';
import { AuthorCut } from './AuthorCut';
import { Poster } from './Poster';
import { ScoreLine } from './ScoreLine';
import { Text } from './Text';

export type FeedItem = {
  readonly id: string;
  readonly author: string;
  /** Como referir esta pessoa na frase de nota cega. */
  readonly authorPronoun: 'she' | 'he' | 'they';
  readonly when: string;
  readonly title: string;
  /** Ano, ou "T3 · E6" quando a entrada é de um episódio. */
  readonly qualifier: string;
  readonly tint: PosterTint;
  /** `null` até eu ter dado a minha nota. Regra 1, imposta pelo RLS. */
  readonly score: number | null;
  readonly note: string | null;
};

export function FeedEntry({
  item,
  onOpen,
  onRate,
}: {
  readonly item: FeedItem;
  readonly onOpen: () => void;
  readonly onRate: () => void;
}) {
  const { t } = useI18n();
  const blind = item.score === null;

  return (
    <Pressable
      onPress={onOpen}
      style={{
        flexDirection: 'row',
        gap: space.s12,
        paddingHorizontal: space.s20,
        paddingVertical: space.s16,
        borderTopWidth: border.hairline,
        borderTopColor: color.lineHairline,
      }}
    >
      <Poster title={item.title} tint={item.tint} scale="entry" />
      <View style={{ flex: 1, minWidth: 0, gap: space.s8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s6 }}>
          <AuthorCut />
          <Text role="personSmall">{item.author}</Text>
          <Text role="metaTight">{item.when}</Text>
        </View>
        <Text role="entryTitle">
          {item.title} <Text role="entryTitle" tone={color.inkMute}>{item.qualifier}</Text>
        </Text>
        <ScoreLine
          score={item.score}
          onPress={blind ? onRate : undefined}
          accessibilityLabel={blind ? t('feed.blindPrompt') : undefined}
        />
        {blind ? (
          <Text role="eyebrow" tone={color.emberMuted}>
            {t(item.authorPronoun === 'she' ? 'feed.blindPromptFeminine' : 'feed.blindPrompt')}
          </Text>
        ) : item.note === null ? null : (
          <Text role="quote">{item.note}</Text>
        )}
      </View>
    </Pressable>
  );
}

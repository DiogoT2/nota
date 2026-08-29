import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { border, color, limit, space } from '@/theme';
import { useI18n, type MessageKey } from '@/i18n';
import { Button, Gutter, Poster, Screen, Text } from '@/components';
import { titleDetail } from '@/data/fixtures';

type Bucket = { readonly id: string; readonly label: MessageKey; readonly hint: MessageKey };

/**
 * Passo 1 de 2. O balde é a ÚNICA coisa que peço em linguagem natural, e é
 * grosseiro de propósito: define o intervalo, não o número. Sem ícones e sem
 * cor por balde — a cor entra só na confirmação, quando a nota acende.
 */
const buckets: readonly Bucket[] = [
  { id: 'loved', label: 'rate.bucketLoved', hint: 'rate.bucketLovedHint' },
  { id: 'liked', label: 'rate.bucketLiked', hint: 'rate.bucketLikedHint' },
  { id: 'meh', label: 'rate.bucketMeh', hint: 'rate.bucketMehHint' },
];

export default function BucketScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [chosen, setChosen] = useState<Bucket | null>(null);

  return (
    <Screen scroll={false} style={{ flexDirection: 'column' }}>
      <Gutter
        style={{
          paddingTop: space.s8,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <Text role="eyebrow">{t('rate.stepOf', { current: 1, total: 2 })}</Text>
        <Button variant="bare" label={t('rate.exit')} onPress={() => router.back()} />
      </Gutter>

      <Gutter
        style={{
          flexDirection: 'row',
          gap: space.s14,
          alignItems: 'flex-end',
          paddingTop: space.s26,
          paddingBottom: space.s22,
        }}
      >
        <Poster title={titleDetail.title} tint={titleDetail.tint} scale="rate" />
        <View style={{ flex: 1 }}>
          <Text role="workTitle">{titleDetail.title}</Text>
          <Text role="metaTight" tone={color.inkDim} style={{ marginTop: space.s8 }}>
            {titleDetail.meta}
          </Text>
        </View>
      </Gutter>

      <Gutter style={{ paddingBottom: space.s18 }}>
        <Text role="question">{t('rate.bucketQuestion')}</Text>
      </Gutter>

      {buckets.map((bucket) => (
        <Pressable
          key={bucket.id}
          onPress={() => {
            setChosen(bucket);
            router.push('/avaliar/comparar');
          }}
          style={({ pressed }) => ({
            borderTopWidth: border.hairline,
            borderTopColor: color.lineRule,
            paddingVertical: space.s26,
            paddingHorizontal: space.s20,
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: space.s14,
            backgroundColor: pressed ? color.bgPressed : color.transparent,
          })}
        >
          <Text role="bucket">{t(bucket.label)}</Text>
          <Text role="metaTight" tone={color.inkDim}>
            {t(bucket.hint)}
          </Text>
        </Pressable>
      ))}

      <View
        style={{
          borderTopWidth: border.hairline,
          borderTopColor: color.lineRule,
          paddingVertical: space.s22,
          paddingHorizontal: space.s20,
        }}
      >
        <Text role="bucketQuiet">{t('rate.bucketAbandoned')}</Text>
      </View>

      <View style={{ flex: 1 }} />

      <View
        style={{
          borderTopWidth: border.hairline,
          borderTopColor: color.lineHairline,
          paddingVertical: space.s18,
          paddingHorizontal: space.s20,
        }}
      >
        {chosen === null ? (
          <Text role="footnoteQuiet" tone={color.inkGhost}>
            {t('rate.bucketFootnote')}
          </Text>
        ) : (
          <Text role="footnoteQuiet" tone={color.ember}>
            {t('rate.bucketChosen', { bucket: t(chosen.label), count: limit.comparisons })}
          </Text>
        )}
      </View>
    </Screen>
  );
}

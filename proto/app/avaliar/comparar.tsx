import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { border, color, limit, metric, opacity, space, type PosterTint } from '@/theme';
import { useI18n } from '@/i18n';
import { Button, Gutter, Poster, ProgressTicks, ScoreLine, Screen, Text } from '@/components';
import { contenders, titleDetail } from '@/data/fixtures';

/**
 * Passo 2 de 2, e o coração do produto: a nota é o OUTPUT das comparações.
 * Cinco rondas no máximo, cada uma corta metade da lista, e há sempre uma
 * saída ("não sei") para não forçar uma preferência que não existe.
 *
 * O número só aparece no fim — e o utilizador nunca o escreveu (regra 4).
 */
export default function CompareScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [round, setRound] = useState(0);

  const placed = round >= limit.comparisons;
  const opponent = contenders[Math.min(round, contenders.length - 1)];
  const advance = () => setRound((current) => current + 1);

  if (placed) {
    return (
      <Screen scroll={false}>
        <Gutter style={{ paddingTop: space.s80 }}>
          <Text role="eyebrow" tone={color.emberMuted}>
            {t('rate.placedLabel')}
          </Text>
          <Text role="screenTitle" style={{ marginTop: space.s18 }}>
            {titleDetail.title}
          </Text>
          <View style={{ marginTop: space.s22 }}>
            <ScoreLine score={titleDetail.myScore} scale="poster" mine />
          </View>
          <View
            style={{
              marginTop: space.s26,
              borderTopWidth: border.hairline,
              borderTopColor: color.lineRule,
              paddingTop: space.s16,
            }}
          >
            <Text role="quote">
              {t('rate.placedBody', {
                position: titleDetail.rankPosition,
                total: titleDetail.rankTotal,
                above: titleDetail.above,
                below: titleDetail.below,
                revealed: titleDetail.revealedAfterRating,
              })}
            </Text>
          </View>
          <View style={{ marginTop: space.s26 }}>
            <Button
              label={t('rate.seeDisagreement')}
              onPress={() => router.replace('/titulo/anatomia')}
            />
          </View>
          <View style={{ marginTop: space.s14 }}>
            <Button variant="bare" label={t('rate.restart')} onPress={() => setRound(0)} />
          </View>
        </Gutter>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Gutter
        style={{ paddingTop: space.s10, flexDirection: 'row', alignItems: 'center', gap: space.s10 }}
      >
        <ProgressTicks total={limit.comparisons} done={round} />
        <Text role="eyebrow" style={{ fontVariant: ['tabular-nums'] }}>
          {t('rate.progress', { current: round + 1, total: limit.comparisons }).toUpperCase()}
        </Text>
      </Gutter>

      <Gutter style={{ paddingTop: space.s30, paddingBottom: space.s20 }}>
        <Text role="prompt">{t('rate.compareQuestion')}</Text>
      </Gutter>

      <Gutter style={{ flexDirection: 'row', gap: space.hair }}>
        <Choice
          title={titleDetail.title}
          tint={titleDetail.tint}
          meta={titleDetail.meta}
          onPress={advance}
        />
        <View style={{ width: metric.choiceDivider, alignItems: 'center', justifyContent: 'center' }}>
          <Text role="sectionLabel" tone={color.inkTrace}>
            {t('common.or')}
          </Text>
        </View>
        {opponent === undefined ? null : (
          <Choice
            title={opponent.title}
            tint={opponent.tint}
            meta={opponent.meta}
            onPress={advance}
          />
        )}
      </Gutter>

      <View style={{ flex: 1 }} />

      <View style={{ alignItems: 'center', padding: space.s20 }}>
        <Button variant="quiet" label={t('rate.skip')} onPress={advance} />
      </View>
      <Gutter style={{ paddingBottom: space.s40 }}>
        <Text role="footnoteQuiet" tone={color.inkVoid} style={{ textAlign: 'center' }}>
          {t('rate.compareFootnote', { count: limit.comparisons })}
        </Text>
      </Gutter>
    </Screen>
  );
}

function Choice({
  title,
  tint,
  meta,
  onPress,
}: {
  readonly title: string;
  readonly tint: PosterTint;
  readonly meta: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? opacity.pressed : 1 })}
    >
      <Poster title={title} tint={tint} scale="choice" />
      <Text role="rowTitle" style={{ marginTop: space.s10 }}>
        {title}
      </Text>
      <Text role="metaTight" style={{ marginTop: space.s4 }}>
        {meta}
      </Text>
    </Pressable>
  );
}

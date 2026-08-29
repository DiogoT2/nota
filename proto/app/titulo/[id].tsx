import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { border, color, limit, space } from '@/theme';
import { useI18n } from '@/i18n';
import {
  Button,
  CircleScoreRow,
  Gutter,
  Poster,
  ScoreLine,
  Screen,
  Text,
} from '@/components';
import { titleCircle, titleDetail } from '@/data/fixtures';

/**
 * Detalhe do título. As notas do Círculo aparecem ORDENADAS POR DISTÂNCIA à
 * minha — a lista é sobre desacordo, não sobre popularidade. Só chego aqui
 * depois de ter dado a minha nota; sem ela, nada disto existe (regra 1).
 */
export default function TitleScreen() {
  const { t } = useI18n();
  const router = useRouter();

  const byDistance = [...titleCircle].sort(
    (a, b) => Math.abs(a.score - titleDetail.myScore) - Math.abs(b.score - titleDetail.myScore),
  );

  return (
    <Screen>
      <Gutter style={{ paddingTop: space.s8, paddingBottom: space.s12 }}>
        <Button
          variant="bare"
          label={t('common.back', { destination: t('feed.title') })}
          onPress={() => router.back()}
        />
      </Gutter>

      <Gutter style={{ flexDirection: 'row', gap: space.s16, paddingBottom: space.s20 }}>
        <Poster title={titleDetail.title} tint={titleDetail.tint} scale="detail" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text role="workTitle">{titleDetail.title}</Text>
          <Text role="meta" style={{ marginTop: space.s8 }}>
            {titleDetail.meta}
          </Text>
          <Text role="eyebrow" tone={color.emberMuted} style={{ marginTop: space.s14 }}>
            {t('title.rankPosition', { position: titleDetail.rankPosition })}
          </Text>
        </View>
      </Gutter>

      <View
        style={{
          backgroundColor: color.bgRaised,
          borderTopWidth: border.cut,
          borderTopColor: color.ember,
          paddingVertical: space.s16,
        }}
      >
        <Gutter>
          <Text role="eyebrow" tone={color.emberMuted}>
            {t('title.myScore')}
          </Text>
          <View style={{ marginTop: space.s10 }}>
            <ScoreLine score={titleDetail.myScore} scale="detail" mine cutColor={color.bgRaised} />
          </View>
          <Text role="footnote" tone={color.inkFaint} style={{ marginTop: space.s10 }}>
            {t('title.derivedFrom', { count: titleDetail.comparisons })}
          </Text>
        </Gutter>
      </View>

      <Gutter
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingTop: space.s20,
          paddingBottom: space.s8,
        }}
      >
        <Text role="sectionLabel">{t('title.circle')}</Text>
        <Text role="tally" tone={color.inkMute}>
          {t('title.sortedByDistance').toUpperCase()}
        </Text>
      </Gutter>

      {byDistance.map((entry) => (
        <CircleScoreRow key={entry.id} entry={entry} mine={titleDetail.myScore}>
          {Math.abs(entry.score - titleDetail.myScore) > limit.disagreementHatch ? (
            <View style={{ flexDirection: 'row', gap: space.s8, marginTop: space.hair }}>
              <Button variant="quiet" label={t('title.reply')} onPress={() => undefined} />
              <Button variant="quiet" label={t('title.disagree')} onPress={() => undefined} />
            </View>
          ) : null}
        </CircleScoreRow>
      ))}

      <Gutter style={{ paddingTop: space.s16 }}>
        <Text role="footnoteQuiet" tone={color.inkTrace}>
          {t('title.replyLimit', { count: limit.replyChars })}
        </Text>
      </Gutter>
    </Screen>
  );
}

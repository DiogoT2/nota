import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { border, color, metric, space } from '@/theme';
import { useI18n } from '@/i18n';
import {
  AuthorCut,
  Button,
  DisagreementTrack,
  EpisodeChart,
  Gutter,
  Poster,
  Screen,
  Text,
} from '@/components';
import { seasonEpisodes, seriesDetail } from '@/data/fixtures';

/**
 * Detalhe da série. Os episódios que ainda não vi estão OCULTOS por omissão:
 * um contorno vazio a meio do gráfico dizia-me quantos me faltam, e isso é
 * pressão, não informação. Só aparecem se eu os pedir.
 */
export default function SeriesScreen() {
  const { t, formatScore } = useI18n();
  const router = useRouter();
  const [showUnseen, setShowUnseen] = useState(false);

  const unseen = seasonEpisodes.filter((episode) => episode.mine === null);
  const visible = showUnseen ? seasonEpisodes : seasonEpisodes.filter((e) => e.mine !== null);
  const { disagreement } = seriesDetail;

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
        <Poster title={seriesDetail.title} tint={seriesDetail.tint} scale="detail" />
        <View style={{ flex: 1 }}>
          <Text role="workTitle">{seriesDetail.title}</Text>
          <Text role="meta" style={{ marginTop: space.s8 }}>
            {`${seriesDetail.meta} · ${t('series.seasons', { count: seriesDetail.seasons })}`}
          </Text>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.s8, marginTop: space.s14 }}
          >
            <Text role="score">{formatScore(seriesDetail.average)}</Text>
            <Text role="tally" tone={color.inkMute} style={{ maxWidth: metric.legendColumn }}>
              {t('series.averageOfMyScores').toUpperCase()}
            </Text>
          </View>
        </View>
      </Gutter>

      <Gutter style={{ flexDirection: 'row', gap: space.hair, paddingBottom: space.s18 }}>
        {Array.from({ length: seriesDetail.seasons + 1 }, (_, index) => index + 1).map((season) => {
          const selected = season === seriesDetail.selectedSeason;
          const future = season > seriesDetail.seasons;
          return (
            <View
              key={season}
              style={{
                flex: 1,
                paddingVertical: space.s12,
                alignItems: 'center',
                backgroundColor: selected ? color.ember : color.transparent,
                borderWidth: selected ? 0 : border.hairline,
                borderColor: color.lineRule,
              }}
            >
              <Text
                role="sectionLabel"
                tone={selected ? color.onEmber : future ? color.inkVoid : color.inkFaint}
              >
                {t('common.seasonShort', { number: season })}
              </Text>
            </View>
          );
        })}
      </Gutter>

      <View style={{ borderTopWidth: border.cut, borderTopColor: color.lineRule }}>
        <Gutter
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            paddingTop: space.s18,
            paddingBottom: space.s10,
          }}
        >
          <Text role="sectionLabel">
            {t('series.season', { number: seriesDetail.selectedSeason })}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.s12 }}>
            <Legend tone={color.ember} label={t('series.legendMine').toUpperCase()} />
            <Legend tone={color.inkMid} label={t('series.legendCircle').toUpperCase()} />
          </View>
        </Gutter>
      </View>

      <Gutter style={{ paddingTop: space.s16 }}>
        <EpisodeChart episodes={visible} />
      </Gutter>

      <Gutter style={{ paddingTop: space.s22 }}>
        <Pressable
          onPress={() => setShowUnseen((current) => !current)}
          style={{
            borderTopWidth: border.hairline,
            borderBottomWidth: border.hairline,
            borderColor: color.lineRule,
            paddingVertical: space.s14,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text role="personSmall" tone={color.inkSoft}>
            {t(showUnseen ? 'series.unseenVisible' : 'series.unseenHidden', {
              count: unseen.length,
            })}
          </Text>
          <Text role="eyebrow" tone={color.ember}>
            {t(showUnseen ? 'series.hide' : 'series.show')}
          </Text>
        </Pressable>
      </Gutter>

      <Gutter style={{ paddingTop: space.s20 }}>
        <Text role="sectionLabel">{t('series.biggestDisagreement')}</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.s8,
            marginTop: space.s14,
          }}
        >
          <AuthorCut />
          <Text role="person" style={{ flex: 1 }}>
            {`${t('common.episodeShort', { number: disagreement.episode })} · ${disagreement.person}`}
          </Text>
          <Text role="scoreSmall">{formatScore(disagreement.theirs)}</Text>
          <Text role="delta" tone={color.ember} style={{ width: metric.deltaColumn, textAlign: 'right' }}>
            {t('common.delta', {
              value: formatScore(Math.abs(disagreement.theirs - disagreement.mine)),
            })}
          </Text>
        </View>
        <View style={{ marginTop: space.s8 }}>
          <DisagreementTrack mine={disagreement.mine} theirs={disagreement.theirs} />
        </View>
        <Text role="quote" style={{ marginTop: space.s8 }}>
          {disagreement.note}
        </Text>
      </Gutter>
    </Screen>
  );
}

function Legend({ tone, label }: { readonly tone: string; readonly label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
      <View style={{ width: metric.legendMark, height: metric.progressTick, backgroundColor: tone }} />
      <Text role="tally">{label}</Text>
    </View>
  );
}

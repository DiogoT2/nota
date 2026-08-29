import { useMemo, useState } from 'react';
import { View } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { border, color, metric, opacity, size, space } from '@/theme';
import { useI18n } from '@/i18n';
import { Gutter, Masthead, Poster, Screen, Text } from '@/components';
import { deriveScores, reorder } from '@/ranking/derive';
import { ranking, rankingTotal, type RankedTitle } from '@/data/fixtures';

/**
 * O ranking pessoal, arrastável. Arrastar não edita uma nota — reescreve a
 * ORDEM, e as notas são recalculadas a partir dela por
 * {@link deriveScores}, que as mantém monótonas: nunca há um #4 acima de um #3.
 */
export default function RankingScreen() {
  const { t, formatScore } = useI18n();
  const [order, setOrder] = useState<readonly RankedTitle[]>(ranking);
  const scores = useMemo(() => deriveScores(order.length), [order.length]);

  return (
    <Screen scroll={false}>
      <Masthead tally={t('ranking.titles', { count: rankingTotal }).toUpperCase()} />

      <Gutter style={{ paddingTop: space.s18, paddingBottom: space.s6 }}>
        <Text role="screenTitle">{t('ranking.heading')}</Text>
      </Gutter>
      <Gutter style={{ paddingTop: space.s8, paddingBottom: space.s16 }}>
        <Text role="footnote" style={{ maxWidth: metric.measure }}>
          {t('ranking.instructions')}
        </Text>
      </Gutter>

      <DraggableFlatList
        data={order as RankedTitle[]}
        keyExtractor={(item) => item.id}
        containerStyle={{ flex: 1 }}
        onDragEnd={({ from, to }) => setOrder((current) => reorder(current, from, to))}
        ListFooterComponent={
          <Gutter style={{ paddingVertical: space.s22 }}>
            <Text role="footnoteQuiet" tone={color.inkTrace}>
              {t('ranking.filters', { year: new Date().getFullYear() })}
            </Text>
          </Gutter>
        }
        renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<RankedTitle>) => {
          const index = getIndex() ?? 0;
          const score = scores[index] ?? 0;
          return (
            <View
              onTouchStart={drag}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.s12,
                paddingHorizontal: space.s20,
                paddingVertical: space.s12,
                borderBottomWidth: border.hairline,
                borderBottomColor: color.lineHairline,
                backgroundColor: isActive ? color.bgPressed : color.bgBase,
                opacity: isActive ? opacity.dragging : 1,
              }}
            >
              <Text role="position" style={{ width: metric.positionColumn }}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Poster title={item.title} tint={item.tint} scale="row" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text role="rowTitle" numberOfLines={1}>
                  {item.title}
                </Text>
                <View
                  style={{
                    marginTop: space.s6,
                    height: size.beamThin,
                    backgroundColor: color.lineRule,
                  }}
                >
                  <View
                    style={{
                      height: size.beamThin,
                      width: `${(score / size.beamTicks) * 100}%`,
                      backgroundColor: color.ember,
                      opacity: opacity.rankBar,
                    }}
                  />
                </View>
              </View>
              <Text role="scoreSmall">{formatScore(score)}</Text>
              <View style={{ gap: metric.progressTick }}>
                {[0, 1, 2].map((line) => (
                  <View
                    key={line}
                    style={{ width: metric.gripLine, height: metric.hairLine, backgroundColor: color.inkGhost }}
                  />
                ))}
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

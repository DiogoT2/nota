import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { border, color, limit, metric, space } from '@/theme';
import { useI18n, type MessageKey } from '@/i18n';
import {
  Button,
  DisagreementTrack,
  Gutter,
  Poster,
  Rule,
  Screen,
  Text,
} from '@/components';
import { profile } from '@/data/fixtures';

/**
 * O mesmo perfil, três vezes. Não há cadeados nem ecrãs de erro: o que muda
 * entre um estranho, um seguidor e alguém do Círculo é a QUANTIDADE DE
 * ESTRUTURA VISÍVEL. O ranking de um estranho está lá — em barras apagadas,
 * na mesma forma, ilegível.
 *
 * Isto é apenas o desenho da diferença. Quem a IMPÕE é o RLS (regras 2 e 3):
 * este ecrã nunca recebe do servidor o que não deve mostrar.
 */
type Relationship = 'stranger' | 'follower' | 'circle';

const viewerLabel: Readonly<Record<Relationship, MessageKey>> = {
  stranger: 'profile.viewedByStranger',
  follower: 'profile.viewedByFollower',
  circle: 'profile.viewedByCircle',
};

export default function ProfileScreen() {
  const { t, formatScore } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ readonly visto?: string }>();
  const relationship: Relationship =
    params.visto === 'circulo' ? 'circle' : params.visto === 'seguidor' ? 'follower' : 'stranger';

  const inCircle = relationship === 'circle';

  return (
    <Screen>
      <Gutter style={{ paddingTop: space.s10 }}>
        <Text role="eyebrow" tone={color.inkGhost}>
          {t(viewerLabel[relationship])}
        </Text>
      </Gutter>

      <Gutter style={{ paddingTop: space.s22, paddingBottom: space.s18 }}>
        <View style={{ flexDirection: 'row', gap: space.s14, alignItems: 'flex-start' }}>
          {/* O corte de luz à esquerda do avatar é o único sinal de Círculo. */}
          {inCircle ? <View style={{ width: border.cut, height: metric.avatar, backgroundColor: color.ember }} /> : null}
          <View
            style={{
              width: metric.avatar,
              height: metric.avatar,
              backgroundColor: color.bgRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text role="workTitle" tone={color.inkSoft}>
              {profile.initials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text role="workTitle">{profile.name}</Text>
            <Text role="metaTight" style={{ marginTop: space.s6 }}>
              {`@${profile.handle} · ${profile.place}`}
            </Text>
          </View>
        </View>

        <Text role="quote" style={{ marginTop: space.s14 }}>
          {profile.bio}
        </Text>

        {relationship === 'stranger' ? (
          <View style={{ marginTop: space.s16 }}>
            <Button label={t('profile.follow')} onPress={() => router.setParams({ visto: 'seguidor' })} />
          </View>
        ) : null}
      </Gutter>
      <Rule />

      <Gutter style={{ paddingTop: space.s20, paddingBottom: space.s12 }}>
        <Text role="sectionLabel">{t('profile.top', { count: limit.topTitles })}</Text>
      </Gutter>
      <Gutter style={{ flexDirection: 'row', gap: space.s4 }}>
        {profile.top.map((entry) => (
          <Poster key={entry.id} title={entry.title} tint={entry.tint} scale="grid" />
        ))}
      </Gutter>

      {inCircle ? (
        <Gutter style={{ paddingTop: space.s22 }}>
          <View style={{ borderTopWidth: border.cut, borderTopColor: color.lineRule, paddingTop: space.s18 }}>
            <Text role="sectionLabel">{t('profile.whereYouDisagree')}</Text>
            <View style={{ marginTop: space.s16, gap: space.s16 }}>
              {profile.disagreements.map((entry) => (
                <View key={entry.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s8 }}>
                    <Text role="person" style={{ flex: 1 }}>
                      {entry.title}
                    </Text>
                    <Text role="scoreSmall">{formatScore(entry.theirs)}</Text>
                    <Text role="delta" tone={color.ember} style={{ width: metric.deltaColumn, textAlign: 'right' }}>
                      {t('common.delta', {
                        value: formatScore(Math.abs(entry.theirs - entry.mine)),
                      })}
                    </Text>
                  </View>
                  <View style={{ marginTop: space.s6 }}>
                    <DisagreementTrack mine={entry.mine} theirs={entry.theirs} />
                  </View>
                </View>
              ))}
            </View>
            <View
              style={{
                marginTop: space.s20,
                borderTopWidth: border.hairline,
                borderTopColor: color.lineHairline,
                paddingTop: space.s16,
              }}
            >
              <Text role="footnote">{t('profile.circleFootnote', { count: limit.replyChars })}</Text>
            </View>
          </View>
        </Gutter>
      ) : (
        <Gutter style={{ paddingTop: space.s26 }}>
          <View style={{ borderTopWidth: border.hairline, borderTopColor: color.lineRule, paddingTop: space.s18 }}>
            <Text role="sectionLabel" tone={color.inkVoid}>
              {t('profile.personalRanking')}
            </Text>
            {/* Está lá. Não se lê. Nenhuma nota chega ao cliente. */}
            <View style={{ marginTop: space.s14, gap: space.s8 }}>
              {[100, 82, 91, 70].map((width, index) => (
                <View
                  key={width}
                  style={{
                    height: metric.inertBar,
                    width: `${width}%`,
                    backgroundColor: index === 3 ? color.bgInertDeep : color.bgInert,
                  }}
                />
              ))}
            </View>
            <Text role="footnote" tone={color.inkGhost} style={{ marginTop: space.s16 }}>
              {t('profile.rankingClosed', {
                name: profile.name.split(' ')[0] ?? profile.name,
                pronoun: t(`profile.pronoun${profile.pronoun === 'she' ? 'She' : 'He'}` as MessageKey),
              })}
            </Text>
          </View>
        </Gutter>
      )}
    </Screen>
  );
}

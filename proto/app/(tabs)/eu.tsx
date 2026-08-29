import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { border, color, space } from '@/theme';
import { useI18n, type MessageKey } from '@/i18n';
import { Gutter, Masthead, Poster, Screen, Text } from '@/components';
import { profile, rankingTotal } from '@/data/fixtures';

/**
 * O meu perfil. A entrada útil daqui é poder ver-me como me vêem: um perfil
 * que não se consegue inspeccionar do lado de fora é um perfil que ninguém
 * confia. As três vistas são o mesmo ecrã, com relações diferentes.
 */
const views: readonly { readonly id: string; readonly label: MessageKey }[] = [
  { id: 'estranho', label: 'me.asStranger' },
  { id: 'seguidor', label: 'me.asFollower' },
  { id: 'circulo', label: 'me.asCircle' },
];

export default function MeScreen() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <Screen>
      <Masthead tally={t('ranking.titles', { count: rankingTotal }).toUpperCase()} />

      <Gutter style={{ paddingTop: space.s18, paddingBottom: space.s16 }}>
        <Text role="screenTitle">{t('me.heading')}</Text>
        <Text role="metaTight" style={{ marginTop: space.s8 }}>
          {`@${profile.handle} · ${profile.place}`}
        </Text>
      </Gutter>

      <Gutter style={{ flexDirection: 'row', gap: space.s4, paddingBottom: space.s26 }}>
        {profile.top.map((entry) => (
          <Poster key={entry.id} title={entry.title} tint={entry.tint} scale="grid" />
        ))}
      </Gutter>

      <Gutter style={{ paddingBottom: space.s12 }}>
        <Text role="sectionLabel">{t('me.seeProfileAs')}</Text>
      </Gutter>
      {views.map((view) => (
        <Row
          key={view.id}
          label={t(view.label)}
          onPress={() => router.push(`/perfil/${profile.handle}?visto=${view.id}`)}
        />
      ))}
      <Row label={t('me.shareCard')} onPress={() => router.push('/partilhar/aftersun')} />
    </Screen>
  );
}

function Row({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderTopWidth: border.hairline,
        borderTopColor: color.lineRule,
        paddingVertical: space.s18,
        paddingHorizontal: space.s20,
        backgroundColor: pressed ? color.bgPressed : color.transparent,
      })}
    >
      <View>
        <Text role="rowTitle">{label}</Text>
      </View>
    </Pressable>
  );
}

import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space } from '@/theme';

/**
 * O fundo da sala. Escuro é o modo base, não uma variante — nenhum ecrã
 * aceita um esquema claro.
 *
 * `scroll` é sempre uma lista finita: o feed acaba, e não há scroll infinito.
 */
export function Screen({
  children,
  scroll = true,
  style,
}: {
  readonly children: React.ReactNode;
  readonly scroll?: boolean;
  readonly style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const frame: ViewStyle = { flex: 1, backgroundColor: color.bgBase, paddingTop: insets.top };

  if (!scroll) {
    return <View style={[frame, style]}>{children}</View>;
  }
  return (
    <View style={frame}>
      <ScrollView
        contentContainerStyle={[{ paddingBottom: insets.bottom + space.s40 }, style]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Margem lateral única da app. */
export function Gutter({
  children,
  style,
}: {
  readonly children: React.ReactNode;
  readonly style?: ViewStyle;
}) {
  return <View style={[{ paddingHorizontal: space.s20 }, style]}>{children}</View>;
}

import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { border, color, space } from '@/theme';
import { useI18n, type MessageKey } from '@/i18n';
import { Text } from './Text';

const labels: Readonly<Record<string, MessageKey>> = {
  index: 'tabs.circle',
  procurar: 'tabs.search',
  ranking: 'tabs.ranking',
  eu: 'tabs.me',
};

/**
 * Quatro palavras, sem ícones. O separador activo é um corte de luz por cima
 * — a mesma marca que assina uma entrada.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: color.bgBase,
        borderTopWidth: border.hairline,
        borderTopColor: color.lineHairline,
        paddingHorizontal: space.s20,
        paddingBottom: insets.bottom + space.s10,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const key = labels[route.name];
        if (key === undefined) return null;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              if (!focused) navigation.navigate(route.name);
            }}
            style={{
              flex: 1,
              paddingTop: space.s14,
              marginTop: -border.hairline,
              borderTopWidth: border.cut,
              borderTopColor: focused ? color.ember : color.transparent,
            }}
          >
            <Text role="tab" tone={focused ? color.inkMax : color.inkFaint}>
              {t(key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

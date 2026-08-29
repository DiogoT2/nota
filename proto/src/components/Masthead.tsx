import { View } from 'react-native';
import { space } from '@/theme';
import { useI18n } from '@/i18n';
import { Rule } from './Rule';
import { Text } from './Text';

/** O cabeçalho: wordmark, uma contagem discreta, e a régua acesa por baixo. */
export function Masthead({ tally }: { readonly tally: string }) {
  const { t } = useI18n();
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingHorizontal: space.s20,
          paddingTop: space.s8,
          paddingBottom: space.s12,
        }}
      >
        <Text role="wordmark">{t('brand.name')}</Text>
        <Text role="tally">{tally}</Text>
      </View>
      <Rule weight="ember" />
    </View>
  );
}

import { StyleSheet, Text, View } from 'react-native';
import { color, space, typography } from '@/theme';
import { useI18n } from '@/i18n';

export default function Index() {
  const { t } = useI18n();

  return (
    <View style={styles.screen}>
      <Text style={styles.wordmark}>{t('brand.name')}</Text>
      <Text style={styles.note}>{t('placeholder.building')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bgBase,
    padding: space.s26,
  },
  wordmark: { ...typography.wordmark, color: color.inkMax },
  note: { ...typography.footnote, color: color.inkDim, marginTop: space.s12 },
});

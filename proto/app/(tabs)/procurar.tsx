import { color, metric, space } from '@/theme';
import { useI18n } from '@/i18n';
import { Gutter, Masthead, Screen, Text } from '@/components';
import { useMemo } from 'react';

/**
 * A pesquisa é fase 2 e vive numa Edge Function: o cliente NUNCA fala com o
 * TMDB (CLAUDE.md, proibições permanentes). Até lá o separador existe e diz
 * porquê, em vez de mostrar uma caixa de texto que não procura nada.
 */
export default function SearchScreen() {
  const { t } = useI18n();
  const tally = useMemo(() => t('pending.label').toUpperCase(), [t]);

  return (
    <Screen>
      <Masthead tally={tally} />
      <Gutter style={{ paddingTop: space.s18 }}>
        <Text role="screenTitle">{t('tabs.search')}</Text>
        <Text role="footnote" tone={color.inkGhost} style={{ marginTop: space.s16, maxWidth: metric.measure }}>
          {t('pending.search')}
        </Text>
      </Gutter>
    </Screen>
  );
}

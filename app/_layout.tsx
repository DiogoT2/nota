import { useMemo } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { color } from '@/theme';
import { I18nProvider, resolveLocale } from '@/i18n';

/**
 * Raiz da aplicação. Deliberadamente vazia: o protótipo de UI está em
 * quarentena em `proto/` (ADR 0001) e os ecrãs reais nascem na Fase 5, depois
 * do esquema, do TMDB e do motor de ranking.
 */
export default function RootLayout() {
  const locale = useMemo(() => resolveLocale(), []);

  return (
    <SafeAreaProvider>
      <I18nProvider locale={locale}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.bgBase },
          }}
        />
      </I18nProvider>
    </SafeAreaProvider>
  );
}

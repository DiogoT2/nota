import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { getLocales } from 'expo-localization';
import { ptPT, type Dictionary } from './locales/pt-PT';
import { en } from './locales/en';

export const locales = { 'pt-PT': ptPT as Dictionary, en } as const;
export type Locale = keyof typeof locales;

export const defaultLocale: Locale = 'pt-PT';

/** Caminhos com ponto, validados em compilação: `t('feed.title')`. */
type Leaves<T> = T extends string
  ? ''
  : {
      [K in keyof T & string]: Leaves<T[K]> extends '' ? K : `${K}.${Leaves<T[K]>}`;
    }[keyof T & string];

export type MessageKey = Leaves<Dictionary>;

export type Substitutions = Readonly<Record<string, string | number>>;

export function resolveLocale(): Locale {
  const preferred = getLocales();
  for (const entry of preferred) {
    if (entry.languageTag in locales) return entry.languageTag as Locale;
    if (entry.languageCode === 'pt') return 'pt-PT';
    if (entry.languageCode === 'en') return 'en';
  }
  return defaultLocale;
}

function lookup(dictionary: Dictionary, key: string): string {
  let node: unknown = dictionary;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return key;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' ? node : key;
}

function interpolate(template: string, values: Substitutions | undefined): string {
  if (values === undefined) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => {
    const value = values[name];
    return value === undefined ? whole : String(value);
  });
}

/** O separador decimal é parte da língua: 9,1 em pt-PT, 9.1 em en. */
function decimalSeparator(locale: Locale): string {
  return locale === 'pt-PT' ? ',' : '.';
}

export type Translator = {
  readonly locale: Locale;
  readonly t: (key: MessageKey, values?: Substitutions) => string;
  /** Uma nota é sempre 0–10 com uma casa decimal. Nunca a mostres de outra forma. */
  readonly formatScore: (score: number) => string;
};

export function createTranslator(locale: Locale): Translator {
  const dictionary = locales[locale];
  return {
    locale,
    t: (key, values) => interpolate(lookup(dictionary, key), values),
    formatScore: (score) => score.toFixed(1).replace('.', decimalSeparator(locale)),
  };
}

const I18nContext = createContext<Translator>(createTranslator(defaultLocale));

export function I18nProvider({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}) {
  const value = useMemo(() => createTranslator(locale), [locale]);
  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): Translator {
  return useContext(I18nContext);
}

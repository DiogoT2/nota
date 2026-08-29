// Regras de higiene normal, mais as proibições permanentes do CLAUDE.md.
// As proibições não são convenções: são erros de lint que bloqueiam o merge.
// Uma proibição que depende de disciplina humana não é uma proibição.
const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
const reactNative = require('eslint-plugin-react-native');
const i18next = require('eslint-plugin-i18next');

/** Valores literais de estilo — cor, tamanho, espaçamento — fora dos tokens. */
const semTokens = [
  {
    selector:
      'Property[key.name=/^(color|backgroundColor|borderColor|tintColor|shadowColor)$/] > Literal[value=/^(#|rgb|hsl)/]',
    message: 'Cor literal. Usa um token de src/theme/tokens.ts.',
  },
  {
    selector:
      'Property[key.name=/^(fontSize|lineHeight|letterSpacing|fontWeight)$/] > Literal',
    message: 'Valor tipográfico literal. Usa src/theme/type.ts.',
  },
];

/** O TMDB nunca é chamado do cliente. Só de Edge Functions. */
const semTmdb = [
  {
    selector: 'Literal[value=/themoviedb\.org|api\.tmdb/i]',
    message: 'Chamada ao TMDB a partir do cliente. Tem de passar por uma Edge Function.',
  },
  {
    selector:
      "MemberExpression[object.property.name='env'] > Identifier[name=/TMDB|SERVICE_ROLE/]",
    message: 'Segredo de servidor referido no bundle do cliente.',
  },
];

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'coverage/**',
      // Protótipo em quarentena — ver ADR 0001. Não é código do produto.
      'proto/**',
      'supabase/.temp/**',
    ],
  },
  ...expo,
  prettier,
  {
    // Todo o código do cliente.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    plugins: { 'react-native': reactNative },
    rules: {
      'react-native/no-inline-styles': 'error',
      'react-native/no-color-literals': 'error',
      'no-restricted-syntax': ['error', ...semTokens, ...semTmdb],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Componentes e ecrãs: nenhuma string literal visível ao utilizador.
    files: ['app/**/*.tsx', 'src/components/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-text-only',
          'should-validate-template': true,
        },
      ],
    },
  },
  {
    // Handlers de Edge Functions: Deno, não React Native. As regras de estilo
    // do cliente não se aplicam, e `Deno` é um global legítimo aqui.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: { globals: { Deno: 'readonly' } },
    rules: {
      'react-native/no-inline-styles': 'off',
      'react-native/no-color-literals': 'off',
      // A proibição de chamar o TMDB continua a valer para o cliente. Aqui é
      // exactamente onde ele DEVE ser chamado — é este o servidor.
      'no-restricted-syntax': 'off',
      'no-console': 'off',
    },
  },
  {
    // Os próprios ficheiros de tradução e de tokens são a excepção — é o sítio
    // onde os literais devem viver. Em mais lado nenhum.
    files: ['src/i18n/**/*.ts', 'src/theme/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
];

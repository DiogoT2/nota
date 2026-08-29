module.exports = function (api) {
  api.cache.using(() => process.env.NOTA_PROTO ?? 'app');

  // O protótipo em quarentena tem a sua própria árvore de `src`. Ver ADR 0001.
  const raiz = process.env.NOTA_PROTO === '1' ? './proto/src' : './src';

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      [
        'module-resolver',
        { alias: { '@': raiz }, extensions: ['.ts', '.tsx', '.js', '.json'] },
      ],
      'react-native-worklets/plugin',
    ],
  };
};

import { Image, StyleSheet, Text, View } from 'react-native';
import { color, metric, space, typography } from '@/theme';
import { useI18n } from '@/i18n';

/**
 * F2-8 · Atribuição do TMDB.
 *
 * Não é decoração nem cortesia: os termos de uso do TMDB exigem o logo e a
 * frase de que o produto usa a API mas não é endossado nem certificado por
 * eles. É também requisito de aprovação nas lojas — uma app que usa a API sem
 * atribuição é motivo de rejeição, e de revogação da chave.
 *
 * Vai no ecrã de definições e no rodapé da pesquisa, que são os sítios onde os
 * dados do TMDB aparecem.
 *
 * O logo é o oficial. O SVG descarregado do TMDB está em `assets/tmdb/` como
 * fonte, e os PNG a 1x/2x/3x são rasterizados a partir dele — o `Image` do
 * React Native não lê SVG sem `react-native-svg` e um transformador de Metro,
 * e não vale um transformador para uma imagem fixa de rodapé.
 *
 * Não é recolorido, recortado nem esticado: as regras de marca do TMDB não o
 * permitem. É a única imagem desta app que não obedece aos nossos tokens.
 */
export function AtribuicaoTmdb({ compacta = false }: { readonly compacta?: boolean }) {
  const { t } = useI18n();

  return (
    <View style={styles.caixa}>
      <Image
        source={require('../../assets/tmdb/tmdb-logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="TMDB"
      />
      <Text style={styles.texto}>
        {compacta ? t('tmdb.dataFrom') : t('tmdb.attribution')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    alignItems: 'flex-start',
    gap: space.s8,
    paddingVertical: space.s16,
  },
  logo: {
    // 273x35 no original. A altura segue a largura pela proporção do ficheiro,
    // que o resizeMode 'contain' preserva.
    width: metric.measureShort,
    height: space.s34,
  },
  texto: {
    ...typography.footnoteQuiet,
    color: color.inkDim,
    maxWidth: metric.measure,
  },
});

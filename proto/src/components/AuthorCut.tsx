import { View } from 'react-native';
import { border, color, size } from '@/theme';

/**
 * O corte de luz de 2px. Assina uma entrada e, à esquerda de um avatar,
 * é o único sinal de que aquela pessoa está no Círculo — não há cadeados.
 */
export function AuthorCut({ height = size.authorCut }: { readonly height?: number }) {
  return <View style={{ width: border.cut, height, backgroundColor: color.ember }} />;
}

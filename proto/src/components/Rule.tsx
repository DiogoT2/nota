import { View } from 'react-native';
import { border, color } from '@/theme';

export type RuleWeight = 'hairline' | 'rule' | 'ember';

const weights = {
  hairline: { height: border.hairline, backgroundColor: color.lineHairline },
  rule: { height: border.cut, backgroundColor: color.lineRule },
  /** A régua acesa. Só no topo do ecrã e por baixo do wordmark. */
  ember: { height: border.cut, backgroundColor: color.ember },
} as const;

export function Rule({ weight = 'hairline' }: { readonly weight?: RuleWeight }) {
  return <View style={weights[weight]} />;
}

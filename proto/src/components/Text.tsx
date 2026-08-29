import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { typography, type TypeRole } from '@/theme';

/** `role` de acessibilidade do RN é removido: aqui `role` é tipográfico. */
export type TextProps = Omit<RNTextProps, 'style' | 'role'> & {
  /** O papel tipográfico. Nunca se passa família, corpo ou espaçamento. */
  readonly role: TypeRole;
  /** Só um token de cor: sobrepõe-se ao tom que o papel traz por omissão. */
  readonly tone?: string;
  readonly style?: RNTextProps['style'];
};

export function Text({ role, tone, style, ...rest }: TextProps) {
  return <RNText {...rest} style={[typography[role], tone === undefined ? null : { color: tone }, style]} />;
}

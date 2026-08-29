import { Pressable, View } from 'react-native';
import { border, color, opacity, space } from '@/theme';
import { Text } from './Text';

export type ButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  /** `primary` é o único bloco de brasa cheia do ecrã. Um por ecrã, no máximo. */
  readonly variant?: 'primary' | 'quiet' | 'bare';
};

export function Button({ label, onPress, variant = 'primary' }: ButtonProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) =>
        variant === 'primary' ? (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: pressed ? color.emberHot : color.ember,
              paddingVertical: space.s14,
              paddingHorizontal: space.s22,
            }}
          >
            <Text role="actionPrimary">{label}</Text>
          </View>
        ) : variant === 'quiet' ? (
          <View
            style={{
              alignSelf: 'flex-start',
              borderWidth: border.hairline,
              borderColor: pressed ? color.ember : color.lineStrong,
              paddingVertical: space.s8,
              paddingHorizontal: space.s10,
            }}
          >
            <Text role="actionQuiet" tone={pressed ? color.ember : color.inkSoft}>
              {label}
            </Text>
          </View>
        ) : (
          <View style={{ opacity: pressed ? opacity.pressed : 1 }}>
            <Text role="eyebrow" tone={color.inkFaint}>
              {label}
            </Text>
          </View>
        )
      }
    </Pressable>
  );
}

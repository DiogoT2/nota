import { View } from 'react-native';
import { color, metric, space } from '@/theme';

/** Cinco traços. A sequência de comparação nunca é mais longa do que isto. */
export function ProgressTicks({
  total,
  done,
}: {
  readonly total: number;
  readonly done: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: space.hair, flex: 1 }}>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={{
            height: metric.progressTick,
            flex: 1,
            backgroundColor: index <= done ? color.ember : color.lineRule,
          }}
        />
      ))}
    </View>
  );
}

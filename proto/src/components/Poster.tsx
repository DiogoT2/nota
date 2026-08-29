import { View } from 'react-native';
import { color, poster, type PosterTint } from '@/theme';
import { Text } from './Text';

export type PosterScale = 'entry' | 'row' | 'detail' | 'rate' | 'grid' | 'choice';

export type PosterProps = {
  readonly title: string;
  readonly tint: PosterTint;
  readonly scale?: PosterScale;
};

export function Poster({ title, tint, scale = 'entry' }: PosterProps) {
  const shape = poster[scale];
  const fluid = shape.width === undefined;

  return (
    <View
      accessible
      accessibilityLabel={title}
      style={{
        width: shape.width,
        height: shape.height,
        flex: fluid ? 1 : undefined,
        aspectRatio: fluid ? poster.ratio : undefined,
        flexGrow: fluid ? undefined : 0,
        flexShrink: 0,
        backgroundColor: tint,
        padding: shape.pad,
        justifyContent: 'flex-end',
      }}
    >
      {shape.caption ? (
        <Text role="posterCaption" tone={color.onPoster} numberOfLines={3}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

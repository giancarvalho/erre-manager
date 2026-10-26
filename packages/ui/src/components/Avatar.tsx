import { StyleSheet, View } from 'react-native';

import { avatar, radius } from '../tokens';
import { Text } from './Text';

export type AvatarVariant = keyof typeof avatar;

/** Initial on a colored circle (DESIGN §9.5). Decorative: the name is always next to it. */
export function Avatar({ name, variant, size = 40 }: { name: string; variant: AvatarVariant; size?: number }) {
  const v = avatar[variant];
  const big = size >= 56;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      // Ring in the variant's light color at 30% (DESIGN §9.5).
      style={[styles.circle, { width: size, height: size, backgroundColor: v.bg, borderColor: `${v.text}4D` }]}
    >
      <Text
        variant={big ? 'titleLg' : 'label'}
        maxFontSizeMultiplier={1.4}
        style={{ color: v.text, fontWeight: '600' }}
      >
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

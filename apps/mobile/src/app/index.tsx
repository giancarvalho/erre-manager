import { space, type, useTheme } from '@erre/ui';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Empty home screen (Sprint 3). Sprint 8 replaces it with the community hub (D-033).
export default function Home() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg.canvas }]}>
      <View style={styles.column}>
        <Text style={[type.overline, { color: colors.text.muted }]}>Erre</Text>
        <Text accessibilityRole="header" style={[type.titleLg, { color: colors.text.primary }]}>
          Em construção
        </Text>
        <Text style={[type.bodyLg, { color: colors.text.muted }]}>O app da comunidade está chegando.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { width: '100%', maxWidth: 512, alignSelf: 'center', padding: space[6], gap: space[1.5] },
});

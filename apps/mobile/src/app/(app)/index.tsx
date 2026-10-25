import { Avatar, Button, Screen, ScreenHeader, space, Text } from '@erre/ui';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useMe, useSignOut } from '@/lib/session';

// Placeholder home (Sprint 5). Sprint 8 replaces it with the community hub (D-033).
export default function Home() {
  const me = useMe();
  const signOut = useSignOut();
  if (!me.data) return null;
  return (
    <Screen>
      <ScreenHeader
        overline="Erre"
        title={`Oi, ${me.data.displayName}`}
        description="O app da comunidade está chegando."
      />
      <View style={styles.row}>
        <Avatar name={me.data.displayName} variant={me.data.avatarVariant} />
        <Text variant="body" tone="muted">
          {me.data.email}
        </Text>
      </View>
      <Button
        label="Sair"
        loadingLabel="Saindo…"
        loading={signOut.isPending}
        variant="ghost"
        onPress={() => signOut.mutate(undefined, { onSettled: () => router.replace('/entrar') })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[6] },
});

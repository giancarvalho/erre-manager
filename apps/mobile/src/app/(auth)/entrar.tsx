import { safeAppPath } from '@erre/core/client';
import { Button, Screen, ScreenHeader, space, Text } from '@erre/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { signInWithGoogle } from '@/lib/auth';
import { meKey, useMe } from '@/lib/session';

export default function SignInScreen() {
  const params = useLocalSearchParams<{ next?: string; erro?: string }>();
  const next = safeAppPath(params.next);
  const me = useMe();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.erro ? 'Não deu pra entrar com o Google. Tente de novo.' : null,
  );

  if (me.data) return <Redirect href={next as never} />;

  async function start() {
    setError(null);
    setLoading(true);
    const res = await signInWithGoogle(next);
    // Web leaves the page; native comes back here after the browser closes.
    if (Platform.OS === 'web' && !res.error) return;
    setLoading(false);
    if (res.error) {
      setError('Não deu pra começar o login. Tente de novo.');
      return;
    }
    await qc.invalidateQueries({ queryKey: meKey });
    router.replace(next as never);
  }

  return (
    <Screen>
      <ScreenHeader
        overline="Erre"
        title="Entrar"
        description="Use sua conta Google. A gente só guarda seu nome e seu e-mail."
      />
      <View style={styles.actions}>
        <Button
          label="Continuar com Google"
          loadingLabel="Abrindo o Google…"
          loading={loading}
          variant="secondary"
          fullWidth
          onPress={start}
        />
        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { gap: space[2] } });

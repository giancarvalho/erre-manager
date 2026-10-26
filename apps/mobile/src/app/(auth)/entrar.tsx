import { safeAppPath } from '@erre/core/client';
import { Accordion, Button, Screen, space, Text } from '@erre/ui';
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
      <View style={styles.hero}>
        <Text variant="display" accessibilityElementsHidden importantForAccessibility="no">
          🦄
        </Text>
        <Text variant="overline" tone="muted">
          Votação em grupo
        </Text>
        <Text variant="display" accessibilityRole="header">
          Errômetro
        </Text>
        <Text variant="bodyLg" tone="secondary">
          Um emoji por pessoa, a cada rodada. Anônimo, rápido e leve. Até 50 votantes e 300 membros por comunidade.
        </Text>
      </View>
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
        <Text variant="caption" tone="muted">
          A gente só guarda seu nome e seu e-mail. Recebeu um convite? Abra o link que te mandaram.
        </Text>
      </View>
      <View style={styles.how}>
        <Accordion title="Como funciona" icon="💡">
          <View style={styles.steps}>
            {HOW.map((step, i) => (
              <Text key={step} tone="secondary">{`${i + 1}. ${step}`}</Text>
            ))}
          </View>
        </Accordion>
      </View>
    </Screen>
  );
}

// "Ver como funciona" in place of the legacy demo group (P-003, provisional A).
const HOW = [
  'Crie uma comunidade ou entre pelo convite que alguém te mandou.',
  'A cada rodada, dê um emoji pra cada pessoa. Ninguém vê quem votou o quê.',
  'Quando a rodada fecha, sai o resultado, com troféus pra quem mais recebeu cada emoji.',
  'Quer algo pontual? Os eventos são votações únicas, com emojis ou notas de 1 a 10.',
];

const styles = StyleSheet.create({
  hero: { gap: space[2], marginTop: space[8], marginBottom: space[8] },
  actions: { gap: space[3] },
  how: { marginTop: space[8] },
  steps: { gap: space[2] },
});

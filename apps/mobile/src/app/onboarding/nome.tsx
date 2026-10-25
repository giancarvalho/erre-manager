import { DisplayNameSchema, safeAppPath } from '@erre/core/client';
import { Button, ErrorState, LoadingState, Screen, ScreenHeader, space, TextField } from '@erre/ui';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/lib/api';
import { useMe, useUpdateDisplayName } from '@/lib/session';

// CORE-04: first Google sign-in confirms the name taken from the Google account.
export default function OnboardingNameScreen() {
  const params = useLocalSearchParams<{ next?: string }>();
  const me = useMe();
  if (me.isPending) return <LoadingState label="Carregando sua conta…" />;
  if (me.isError) return <ErrorState message="Não deu pra carregar sua conta." onRetry={() => me.refetch()} />;
  if (!me.data) return <Redirect href={`/entrar?next=${encodeURIComponent('/onboarding/nome')}` as never} />;
  return <NameForm initial={me.data.displayName} next={safeAppPath(params.next)} />;
}

function NameForm({ initial, next }: { initial: string; next: string }) {
  const save = useUpdateDisplayName();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function validate(value: string): string | null {
    const parsed = DisplayNameSchema.safeParse(value);
    return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Nome inválido.');
  }

  async function submit() {
    const problem = validate(name);
    setError(problem);
    if (problem) return;
    try {
      await save.mutateAsync(name.trim());
      router.replace((next.startsWith('/onboarding') ? '/' : next) as never);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não deu pra salvar. Tente de novo.');
    }
  }

  return (
    <Screen>
      <ScreenHeader
        overline="Quase lá"
        title="Como você quer aparecer pra comunidade?"
        description="Puxamos esse nome da sua conta Google. Dá pra mudar agora ou depois no seu perfil."
      />
      <View style={styles.form}>
        <TextField
          label="Seu nome"
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (error) setError(null);
          }}
          onBlur={() => setError(validate(name))}
          error={error}
          help="De 2 a 32 caracteres."
          autoComplete="name"
          textContentType="nickname"
          autoCapitalize="words"
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Button
          label="Continuar"
          loadingLabel="Salvando…"
          loading={save.isPending}
          variant="primary"
          fullWidth
          onPress={submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: space[6] } });

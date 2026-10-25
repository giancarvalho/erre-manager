import { CommunityNameSchema } from '@erre/core/client';
import { Button, Screen, ScreenHeader, space, TextField } from '@erre/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/lib/api';
import { useCommunity, useCreateCommunity } from '@/lib/community';

export default function NewCommunity() {
  const create = useCreateCommunity();
  const { select } = useCommunity();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function validate(value: string): string | null {
    const parsed = CommunityNameSchema.safeParse(value);
    return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Nome inválido.');
  }

  async function submit() {
    const problem = validate(name);
    setError(problem);
    if (problem) return;
    try {
      const created = await create.mutateAsync(name.trim());
      select(created.id);
      // Back to the home that opened this screen; replace only when opened directly (deep link).
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não deu pra criar. Tente de novo.');
    }
  }

  return (
    <Screen>
      <Button label="← Voltar" variant="ghost" onPress={() => router.back()} />
      <ScreenHeader
        overline="Nova comunidade"
        title="Dê um nome pra sua comunidade"
        description="É também o código dela. Depois você chama a galera."
      />
      <View style={styles.form}>
        <TextField
          label="Nome da comunidade"
          placeholder="ex: minha-bagunca"
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (error) setError(null);
          }}
          onBlur={() => name && setError(validate(name))}
          error={error}
          help="Letras minúsculas, números e hífens, até 32 caracteres."
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={32}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Button
          label="Criar comunidade"
          loadingLabel="Criando…"
          loading={create.isPending}
          variant="primary"
          fullWidth
          onPress={submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: space[6] } });

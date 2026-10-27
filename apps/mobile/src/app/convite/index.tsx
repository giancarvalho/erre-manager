import { Button, Screen, ScreenHeader, space, TextField } from '@erre/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { parseInviteInput } from '@/lib/invite-input';

/** Join by pasting the invite link or code (CORE-07); the invite screen does the rest. */
export default function EnterInvite() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const code = parseInviteInput(value);
    if (!code) {
      setError('Isso não parece um convite. Cole o link inteiro que te mandaram.');
      return;
    }
    setError(null);
    router.push(`/convite/${code}` as never);
  }

  return (
    <Screen>
      <Button
        label="← Voltar"
        variant="ghost"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <ScreenHeader
        overline="Convite"
        title="Entrar com um convite"
        description="Cole o link de convite que alguém da comunidade te mandou."
      />
      <View style={styles.form}>
        <TextField
          label="Link ou código do convite"
          value={value}
          onChangeText={(text) => {
            setValue(text);
            if (error) setError(null);
          }}
          error={error}
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="url"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button label="Continuar" variant="primary" fullWidth onPress={submit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: space[4] } });

import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Screen, ScreenHeader } from '@/components/ui';
import { authClient } from '@/lib/auth-client';
import { useTheme } from '@/theme/theme';
import { type } from '@/theme/tokens';

export default function SignInScreen() {
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <ScreenHeader overline="Errômetro" title="Entrar" description="Use sua conta Google. A gente só guarda seu nome e e-mail." />
      <Button
        label="Continuar com Google"
        variant="secondary"
        fullWidth
        onPress={async () => {
          setError(null);
          const res = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
          if (res.error) setError('Não deu pra começar o login. Tente de novo.');
        }}
      />
      {error ? <Text style={[type.caption, { color: colors.danger.text, marginTop: 8 }]}>{error}</Text> : null}
    </Screen>
  );
}

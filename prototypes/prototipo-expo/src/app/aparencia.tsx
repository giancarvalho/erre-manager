import { router } from 'expo-router';

import { Button, Screen, ScreenHeader, ThemeSwitcher } from '@/components/ui';

export default function AppearanceScreen() {
  return (
    <Screen>
      <Button label="← Votação" variant="ghost" onPress={() => router.back()} />
      <ScreenHeader overline="Perfil" title="Aparência" description="O tema escuro é o padrão. A escolha fica salva neste aparelho." />
      <ThemeSwitcher />
    </Screen>
  );
}

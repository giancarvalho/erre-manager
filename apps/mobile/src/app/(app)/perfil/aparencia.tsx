import { Button, Screen, ScreenHeader, ThemePicker } from '@erre/ui';
import { router } from 'expo-router';

export default function AppearanceScreen() {
  return (
    <Screen>
      <Button label="← Início" variant="ghost" onPress={() => router.back()} />
      <ScreenHeader
        overline="Perfil"
        title="Aparência"
        description="O tema escuro é o padrão. A escolha fica salva neste aparelho."
      />
      <ThemePicker />
    </Screen>
  );
}

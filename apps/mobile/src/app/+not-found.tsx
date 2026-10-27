import { EmptyState, Screen } from '@erre/ui';
import { router } from 'expo-router';

/** Unknown route (CORE-23): plain words and a way back, never a technical code (DESIGN §9.15). */
export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        emoji="🧭"
        message="Essa página não existe ou mudou de lugar."
        actionLabel="Ir para o início"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}

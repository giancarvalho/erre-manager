// Errômetro UI. Sprint 12 registers it empty: the hub section and the voting screen come in Sprint 14.
import { defineModuleUi } from '@erre/core/client';
import { EmptyState, Screen, ScreenHeader } from '@erre/ui';

import manifest from '../manifest';

/** Placeholder of the Errômetro home until Sprint 14. */
export function HomeScreen() {
  return (
    <Screen>
      <ScreenHeader overline="Comunidade" title="Errômetro" />
      <EmptyState emoji="🗳️" message="A votação do Errômetro chega aqui em breve." />
    </Screen>
  );
}

export default defineModuleUi(manifest, {});

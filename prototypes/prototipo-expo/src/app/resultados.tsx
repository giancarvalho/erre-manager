import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, RankingRow, Screen, ScreenHeader } from '@/components/ui';
import { space } from '@/theme/tokens';

export default function ResultsScreen() {
  return (
    <Screen>
      <Button label="← Votação" variant="ghost" onPress={() => router.back()} />
      <ScreenHeader overline="Resultados" title="Rodada de segunda, 12h" description="O ranking da última rodada fechada." />
      <View style={{ gap: space[3] }}>
        <RankingRow position={1} name="Camila" variant="indigo" chips={['❤️ 5', '🦄 4']} total={9} podium="gold" trophy="❤️" />
        <RankingRow position={2} name="Diego" variant="amber" chips={['🐍 4', '🍪 3']} total={7} podium="silver" />
        <RankingRow position={3} name="Elisa" variant="sky" chips={['🪴 6']} total={6} podium="silver" />
        <RankingRow position={4} name="Bruno" variant="violet" chips={['🎂 2', '💼 1']} total={3} />
      </View>
    </Screen>
  );
}

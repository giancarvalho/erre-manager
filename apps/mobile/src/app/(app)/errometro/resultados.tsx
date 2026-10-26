import { ResultsScreen } from '@erre/errometro/ui';
import { useLocalSearchParams } from 'expo-router';

import { withModule } from '@/lib/modules';

function Results() {
  const { rodada } = useLocalSearchParams<{ rodada?: string }>();
  return <ResultsScreen initialPeriod={rodada} />;
}

export default withModule('errometro', Results);

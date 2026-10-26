import { EventScreen } from '@erre/eventos/ui';
import { useLocalSearchParams } from 'expo-router';

import { withModule } from '@/lib/modules';

function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventScreen key={id} id={id} />;
}

export default withModule('eventos', Screen);

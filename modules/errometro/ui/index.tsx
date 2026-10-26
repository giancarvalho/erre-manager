// Errômetro UI (D-019): hub section, voting, results and administration.
import { defineModuleUi } from '@erre/core/client';

import manifest from '../manifest';
import { HubSection } from './HubSection';
import { TrophiesSection } from './TrophiesSection';

export { AdminScreen } from './AdminScreen';
export { ResultsScreen } from './ResultsScreen';
export { VoteScreen } from './VoteScreen';

export default defineModuleUi(manifest, {
  hubSection: HubSection,
  profileSections: { 'errometro.trofeus': TrophiesSection },
});

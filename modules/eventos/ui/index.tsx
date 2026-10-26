// Eventos UI (D-019): hub section, list, event, voting, results and the profile trophies.
import { defineModuleUi } from '@erre/core/client';

import manifest from '../manifest';
import { HubSection } from './HubSection';
import { TrophiesSection } from './TrophiesSection';

export { EventScreen } from './EventScreen';
export { EventsScreen } from './EventsScreen';
export { ResultsScreen } from './ResultsScreen';
export { VoteScreen } from './VoteScreen';

export default defineModuleUi(manifest, {
  hubSection: HubSection,
  profileSections: { 'eventos.trofeus': TrophiesSection },
});

// Errômetro UI (D-019): hub section and the voting screen. Results and administration come in Sprint 15.
import { defineModuleUi } from '@erre/core/client';

import manifest from '../manifest';
import { HubSection } from './HubSection';

export { VoteScreen } from './VoteScreen';

export default defineModuleUi(manifest, { hubSection: HubSection });

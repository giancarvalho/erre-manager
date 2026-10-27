// App half of Mural de avisos (D-019), registered in apps/mobile/src/modules.ts. Screens are exported for the thin route
// files in apps/mobile/src/app/(app)/avisos/.
import { defineModuleUi } from '@erre/core/client';

import manifest from '../manifest';
import { HubSection } from './HubSection';

export { AvisosScreen } from './AvisosScreen';

export default defineModuleUi(manifest, { hubSection: HubSection });

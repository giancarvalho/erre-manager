// Static registry of module UIs (D-008, D-019). A module shows up only if it is here AND enabled in the
// API (GET /v1/modules). Thin route files in src/app/(app)/<id>/ re-export module screens (ARQUITETURA §5.5).
import type { ModuleUi } from '@erre/core/client';
import avisos from '@erre/avisos/ui';
import errometro from '@erre/errometro/ui';
import eventos from '@erre/eventos/ui';

export const MODULE_UIS: readonly ModuleUi[] = [errometro, eventos, avisos];

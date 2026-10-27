// Static module registry (D-008). Every module the API can mount is listed here; MODULES_ENABLED decides
// which ones are on (D-007). Test-only modules (modules/_*) are never listed.
import type { ModuleApi } from '@erre/core/server';
import avisos from '@erre/avisos/api';
import errometro from '@erre/errometro/api';
import eventos from '@erre/eventos/api';

export const MODULES: readonly ModuleApi[] = [errometro, eventos, avisos];

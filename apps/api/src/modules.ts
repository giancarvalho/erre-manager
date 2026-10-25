// Static module registry (D-008). Every module the API can mount is listed here; MODULES_ENABLED decides
// which ones are on (D-007). Test-only modules (modules/_*) are never listed.
import type { ModuleApi } from '@erre/core/server';

export const MODULES: readonly ModuleApi[] = [];

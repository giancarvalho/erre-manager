// Entry for module manifests (`modules/<id>/manifest.ts`): pure metadata, safe for both the API and the
// app bundles. No React, no server code (D-019).
export { ROLES, type Role } from '../shared/community';
export {
  defineManifest,
  ManifestSchema,
  manifestProblems,
  RESERVED_MODULE_IDS,
  type ModuleManifest,
  type ModuleManifestInput,
} from '../shared/manifest';

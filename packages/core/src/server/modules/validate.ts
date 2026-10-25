import cron from 'node-cron';

import { manifestProblems } from '../../shared/manifest';
import type { ModuleApi } from './define';

/** Boot check of the registered modules (PLANO Sprint 8, task 1). Returns problems; empty = valid. */
export function moduleProblems(modules: readonly ModuleApi[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const mod of modules) {
    const m = mod.manifest;
    for (const p of manifestProblems(m)) problems.push(`${m.id}: ${p}`);
    if (seen.has(m.id)) problems.push(`${m.id}: duplicated module id`);
    seen.add(m.id);
    const prefix = `${m.id}.`;
    const intents = new Set(m.joinIntents.map((i) => i.id));
    const handlers = Object.keys(mod.onJoinApproved ?? {});
    for (const i of intents)
      if (!handlers.includes(i)) problems.push(`${m.id}: join intent "${i}" has no onJoinApproved handler`);
    for (const h of handlers)
      if (!intents.has(h)) problems.push(`${m.id}: onJoinApproved "${h}" is not declared in the manifest`);
    for (const job of mod.jobs ?? []) {
      if (!job.id.startsWith(prefix)) problems.push(`${m.id}: job "${job.id}" must start with "${prefix}"`);
      if (!cron.validate(job.schedule)) problems.push(`${m.id}: job "${job.id}" has an invalid schedule`);
    }
    for (const s of mod.profileSections ?? []) {
      if (!s.id.startsWith(prefix)) problems.push(`${m.id}: profile section "${s.id}" must start with "${prefix}"`);
    }
  }
  return problems;
}

export function parseEnabledModules(value: string | undefined, modules: readonly ModuleApi[]): Set<string> {
  const ids = (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const known = new Set(modules.map((m) => m.manifest.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length) throw new Error(`MODULES_ENABLED lists unknown modules: ${unknown.join(', ')}`);
  return new Set(ids);
}

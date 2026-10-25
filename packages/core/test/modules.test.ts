import { describe, expect, it } from 'vitest';

import { defineModuleApi } from '../src/server/modules/define';
import { moduleProblems, parseEnabledModules } from '../src/server/modules/validate';
import { defineManifest, manifestProblems } from '../src/shared/manifest';

const base = { id: 'demo1', name: 'Demo', icon: 'star' };

describe('manifest', () => {
  it('accepts a valid manifest and fills defaults', () => {
    const m = defineManifest({
      ...base,
      permissions: [{ id: 'demo1.ver', defaultRoles: ['membro'] }],
      menu: [{ label: 'Demo', route: '/demo1/x' }],
    });
    expect(m).toMatchObject({ id: 'demo1', notifications: [], joinIntents: [], commands: [] });
  });

  it.each([
    [{ ...base, id: 'Demo' }, /id/],
    [{ ...base, id: 'core' }, /reserved/],
    [{ ...base, id: 'communities' }, /reserved/],
    [{ ...base, permissions: [{ id: 'outro.ver', defaultRoles: ['membro'] }] }, /must start with "demo1\."/],
    [{ ...base, notifications: [{ id: 'core.x', label: 'x', defaultEnabled: true }] }, /must start with "demo1\."/],
    [{ ...base, joinIntents: [{ id: 'eventos.participar', label: 'x' }] }, /must start with "demo1\."/],
    [{ ...base, menu: [{ label: 'x', route: '/outro' }] }, /must start with "\/demo1"/],
    [{ ...base, menu: [{ label: 'x', route: '/demo10' }] }, /must start with "\/demo1"/],
    [{ ...base, permissions: [{ id: 'demo1.ver', defaultRoles: ['chefe'] }] }, /defaultRoles/],
    [{ ...base, extra: true }, /manifest/],
  ])('rejects %j', (input, error) => {
    expect(manifestProblems(input).join('\n')).toMatch(error);
    expect(() => defineManifest(input as never)).toThrow(/Invalid module manifest/);
  });
});

describe('modules at boot', () => {
  const manifest = defineManifest({ ...base, joinIntents: [{ id: 'demo1.participar', label: 'Participar' }] });
  const ok = defineModuleApi(manifest, { onJoinApproved: { 'demo1.participar': async () => undefined } });

  it('a valid module has no problems', () => {
    expect(moduleProblems([ok])).toEqual([]);
  });

  it('flags missing or extra intent handlers, bad jobs and sections, duplicates', () => {
    const problems = moduleProblems([
      ok,
      defineModuleApi(manifest, {
        onJoinApproved: { 'demo1.outra': async () => undefined },
        jobs: [
          { id: 'outro.job', schedule: '*/5 * * * *', run: async () => undefined },
          { id: 'demo1.job', schedule: 'toda hora', run: async () => undefined },
        ],
        profileSections: [{ id: 'x.secao', load: async () => null }],
      }),
    ]).join('\n');
    expect(problems).toMatch(/duplicated module id/);
    expect(problems).toMatch(/join intent "demo1.participar" has no onJoinApproved handler/);
    expect(problems).toMatch(/onJoinApproved "demo1.outra" is not declared/);
    expect(problems).toMatch(/job "outro.job" must start/);
    expect(problems).toMatch(/job "demo1.job" has an invalid schedule/);
    expect(problems).toMatch(/profile section "x.secao" must start/);
  });

  it('MODULES_ENABLED only accepts registered modules', () => {
    expect([...parseEnabledModules(' demo1 , ', [ok])]).toEqual(['demo1']);
    expect([...parseEnabledModules(undefined, [ok])]).toEqual([]);
    expect(() => parseEnabledModules('demo1,eventos', [ok])).toThrow(/unknown modules: eventos/);
  });
});

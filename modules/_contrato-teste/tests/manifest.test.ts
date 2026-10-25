import { moduleProblems } from '@erre/core/server';
import { tablePrefixProblems } from '@erre/core/testing';
import { describe, expect, it } from 'vitest';

import moduleApi from '../api';
import { tables } from '../db/schema';
import manifest from '../manifest';

describe('contrato-teste manifest', () => {
  it('passes the boot validation', () => {
    expect(moduleProblems([moduleApi])).toEqual([]);
  });

  it('every table has the module prefix', () => {
    expect(tablePrefixProblems(manifest, tables)).toEqual([]);
  });
});

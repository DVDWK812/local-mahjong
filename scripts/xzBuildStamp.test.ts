import { describe, it, expect } from 'vitest';
import { fingerprintEntries, isFingerprintInput, workspaceFingerprint, xzBuildStamp } from './xzBuildStamp';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('portable shared workspace fingerprint', () => {
  it('normalizes Windows/POSIX paths and ordering without changing content', () => {
    expect(fingerprintEntries([{ path: 'src\\game\\a.ts', bytes: 'a' }, { path: 'src/b.ts', bytes: 'b' }]))
      .toBe(fingerprintEntries([{ path: './src/b.ts', bytes: 'b' }, { path: 'src/game/a.ts', bytes: 'a' }]));
  });
  it.each(['src/game/sanma/engine.ts', 'src/game/score/rules/RuleConfig.ts', 'src/game/sanma/fixtures.ts', 'src/game/ai.ts', 'src/presentation/pacing/automaticActionPacing.ts', 'scripts/xzBuildStamp.ts', 'package-lock.json'])('tracks behavior dependency %s', file => {
    expect(isFingerprintInput(file)).toBe(true);
    expect(fingerprintEntries([{ path: file, bytes: 'before' }])).not.toBe(fingerprintEntries([{ path: file, bytes: 'after' }]));
  });
  it('does not fingerprint manual results, screenshots, logs or snapshot metadata', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sanma-stamp-'));
    try {
      await fs.mkdir(path.join(root, 'src')); await fs.writeFile(path.join(root, 'src/a.ts'), 'a');
      const before = await workspaceFingerprint(root);
      await fs.mkdir(path.join(root, 'artifacts'));
      for (const file of ['manual.json', 'screen.png', 'run.log']) await fs.writeFile(path.join(root, 'artifacts', file), 'output');
      await fs.writeFile(path.join(root, '.xz-snapshot.json'), '{}');
      expect(await workspaceFingerprint(root)).toBe(before);
      await fs.writeFile(path.join(root, 'src/a.ts'), 'b');
      expect(await workspaceFingerprint(root)).not.toBe(before);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  it('invalidates the shared virtual stamp for relevant HMR only', () => {
    const plugin = xzBuildStamp(process.cwd()), invalidated: unknown[] = [], module = {};
    const hook = plugin.handleHotUpdate;
    if (typeof hook !== 'function') throw new Error('missing hook');
    const ctx = (file: string) => ({ file: path.join(process.cwd(), file), modules: [], server: { moduleGraph: { getModuleById: () => module, invalidateModule: (m: unknown) => invalidated.push(m) } } });
    hook.call({} as never, ctx('src/game/sanma/engine.ts') as never);
    hook.call({} as never, ctx('artifacts/manual.json') as never);
    expect(invalidated).toEqual([module]);
  });
});

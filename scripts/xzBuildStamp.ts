import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Plugin } from 'vite';
export function xzBuildStamp(root: string): Plugin {
  const virtual = '\0virtual:xz-build';
  let serving = false;
  async function stamp() {
    const fingerprint = await workspaceFingerprint(root);
    let commit = '非 Git 工作区', snapshotId: string | undefined;
    try { const snapshot = JSON.parse(await fs.readFile(path.join(root, '.xz-snapshot.json'), 'utf8')); commit = snapshot.commit; snapshotId = snapshot.snapshotId; }
    catch { try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* content fingerprint remains authoritative */ } }
    return { commit, fingerprint, ...(snapshotId ? { snapshotId } : {}), buildMode: serving ? 'development' : process.env.VITE_ENABLE_TEST_MODE === 'true' ? 'diagnostic' : 'production' };
  }
  return { name: 'xuezhan-build-stamp', resolveId: id => id === 'virtual:xz-build' ? virtual : undefined,
    configResolved(config) { serving = config.command === 'serve'; },
    async load(id) { return id === virtual ? `export default ${JSON.stringify(await stamp())}` : undefined; },
    handleHotUpdate(ctx) { if (!isFingerprintInput(path.relative(root, ctx.file))) return; const module = ctx.server.moduleGraph.getModuleById(virtual); if (module) { ctx.server.moduleGraph.invalidateModule(module); return [...ctx.modules, module]; } },
  };
}

export const normalizeFingerprintPath = (value: string) => value.replaceAll('\\', '/').replace(/^\.\//, '');
/** Shared behavior inputs, including fixtures. Artifacts and manual records are outputs. */
export function isFingerprintInput(value: string): boolean {
  const file = normalizeFingerprintPath(value);
  return /^(src|scripts)\//.test(file) && !file.startsWith('src/music/') && /\.(ts|tsx|js|mjs|css|json|glsl|vert|frag)$/.test(file)
    || /^(package(-lock)?\.json|vite\.config\.ts|tsconfig[^/]*\.json|index\.html)$/.test(file);
}
export function fingerprintEntries(entries: Array<{ path: string; bytes: Uint8Array | string }>): string {
  const hash = createHash('sha256').update('workspace-inputs-v2\0');
  const normalized = entries.map(e => ({ ...e, path: normalizeFingerprintPath(e.path) })).filter(e => isFingerprintInput(e.path));
  normalized.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  for (const entry of normalized) {
    const bytes = typeof entry.bytes === 'string' ? Buffer.from(entry.bytes) : Buffer.from(entry.bytes);
    hash.update(JSON.stringify([entry.path, bytes.length])).update('\0').update(bytes);
  }
  return hash.digest('hex');
}
export async function workspaceFingerprint(root: string): Promise<string> {
  const entries: Array<{ path: string; bytes: Uint8Array }> = [];
  async function walk(dir: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name), relative = normalizeFingerprintPath(path.relative(root, full));
      if (entry.isDirectory()) {
        if ((dir === root && ['src', 'scripts'].includes(entry.name)) || (dir !== root && relative !== 'src/music')) await walk(full);
      } else if (isFingerprintInput(relative)) entries.push({ path: relative, bytes: await fs.readFile(full) });
    }
  }
  await walk(root); return fingerprintEntries(entries);
}

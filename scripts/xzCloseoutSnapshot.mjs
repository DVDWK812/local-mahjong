import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Copy bytes from the working tree, never from HEAD. No git mutations or deletion.
const [destination] = process.argv.slice(2);
if (!destination || !path.isAbsolute(destination)) throw new Error('Provide a new absolute snapshot directory');
const root = process.cwd(), target = path.resolve(destination);
if (target === root || target.startsWith(root + path.sep)) throw new Error('Snapshot must be outside the live repository (avoid duplicate test discovery)');
await fs.mkdir(target); // refuses an existing snapshot
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const tracked = new Set(git(['ls-files', '-z']).split('\0').filter(Boolean));
// Ignored runtime voice indices are real inputs too; do not copy secrets/caches.
const voiceRoot = path.join(root, 'src/music/voice_lines');
const runtimeInputs = ['src/music/voice_lines/voice_packs.json'];
for (const entry of await fs.readdir(voiceRoot, { withFileTypes: true })) if (entry.isDirectory()) runtimeInputs.push(`src/music/voice_lines/${entry.name}/voice_lines.json`);
const candidates = [...new Set([...tracked, ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean), ...runtimeInputs])].sort();
const excluded = candidates.filter(p => /^(artifacts|\.secrets|node_modules|dist|coverage)\//.test(p));
const paths = candidates.filter(p => !excluded.includes(p));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [];
for (const relative of paths) {
  const input = path.join(root, relative);
  try { const bytes = await fs.readFile(input); const output = path.join(target, relative); await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, bytes, { flag: 'wx' }); files.push({ path: relative, bytes: bytes.length, sha256: hash(bytes), tracked: tracked.has(relative) }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; } // tracked deletions remain deleted
}
// Reject a mixed snapshot if concurrent edits occurred during copying.
for (const file of files) if (hash(await fs.readFile(path.join(root, file.path))) !== file.sha256) throw new Error(`Concurrent input change: ${file.path}`);
const snapshotId = hash(JSON.stringify(files.map(({ path, sha256 }) => ({ path, sha256 }))));
const manifest = { version: 1, snapshotId, createdAt: new Date().toISOString(), origin: root, target, commit: git(['rev-parse', 'HEAD']).trim(), node: process.version, lockSha256: files.find(f => f.path === 'package-lock.json')?.sha256, files, excludedNonInputs: excluded, status: git(['status', '--porcelain=v1', '-uall']) };
await fs.writeFile(path.join(target, '.xz-snapshot.json'), JSON.stringify({ snapshotId, commit: manifest.commit }));
await fs.writeFile(path.join(path.dirname(target), `${path.basename(target)}-manifest.json`), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ snapshotId, target, files: files.length, untracked: files.filter(f => !f.tracked).length, bytes: files.reduce((n, f) => n + f.bytes, 0), lockSha256: manifest.lockSha256 }));

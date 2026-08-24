import { promises as fs } from 'node:fs';
import path from 'node:path';

const REGISTRY_FILE = 'generated_voices.json';

/** Local-only record of Fish voices explicitly created from this workspace. */
export class LocalGeneratedVoiceRegistry {
  constructor({ root, now = () => new Date() } = {}) {
    this.root = path.resolve(root ?? process.cwd());
    this.file = path.join(this.root, REGISTRY_FILE);
    this.now = now;
  }

  async list() {
    await this.importExistingVoicePacks();
    const entries = await this.read();
    return entries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async upsert(value) {
    const entry = normalizeCreatedVoice(value, this.now);
    if (!entry) throw new TypeError('Invalid generated voice record.');
    const entries = await this.read();
    const index = entries.findIndex((candidate) => candidate.voiceId === entry.voiceId);
    if (index >= 0) entries[index] = { ...entries[index], ...entry, createdAt: entries[index].createdAt || entry.createdAt };
    else entries.push(entry);
    await this.write(entries);
    return index >= 0 ? entries[index] : entry;
  }

  async remove(voiceId) {
    const entries = await this.read();
    const retained = entries.filter((entry) => entry.voiceId !== voiceId);
    if (retained.length === entries.length) return false;
    await this.write(retained);
    return true;
  }

  /**
   * Imports metadata from local Packs only. `createdAt` means local registry
   * registration time for source=existing; it is never presented as Fish's
   * voice creation time. Existing clone/design records always win.
   */
  async importExistingVoicePacks() {
    const entries = await this.read(); let changed = false;
    let directories = [];
    try { directories = await fs.readdir(this.root, { withFileTypes: true }); } catch (error) { if (error?.code === 'ENOENT') return; throw error; }
    for (const directory of directories.filter((entry) => entry.isDirectory())) {
      let pack;
      try { pack = JSON.parse(await fs.readFile(path.join(this.root, directory.name, 'pack.json'), 'utf8')); } catch { continue; }
      const voiceId = typeof pack?.voiceId === 'string' ? pack.voiceId.trim() : '';
      if (!voiceId) continue;
      const packName = typeof pack?.name === 'string' && pack.name.trim() ? pack.name.trim() : voiceId.slice(0, 8);
      const index = entries.findIndex((entry) => entry.voiceId === voiceId);
      if (index < 0) {
        entries.push({ voiceId, name: packName, source: 'existing', createdAt: this.now().toISOString(), linkedPackIds: [directory.name] }); changed = true;
        continue;
      }
      const linkedPackIds = [...new Set([...(entries[index].linkedPackIds ?? []), directory.name])].sort();
      if (JSON.stringify(linkedPackIds) !== JSON.stringify(entries[index].linkedPackIds ?? [])) { entries[index] = { ...entries[index], linkedPackIds }; changed = true; }
    }
    if (changed) await this.write(entries);
  }

  async read() {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8'));
      const values = Array.isArray(raw) ? raw : Array.isArray(raw?.voices) ? raw.voices : [];
      return values.map((entry) => normalizeCreatedVoice(entry, undefined)).filter(Boolean);
    } catch (error) {
      if (error?.code === 'ENOENT' || error instanceof SyntaxError) return [];
      throw error;
    }
  }

  async write(entries) {
    await fs.mkdir(this.root, { recursive: true });
    const temporary = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify({ schemaVersion: 1, voices: entries }, null, 2)}\n`, 'utf8');
    await fs.rename(temporary, this.file);
  }
}

export function normalizeCreatedVoice(value, now) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const voiceId = typeof value.voiceId === 'string' ? value.voiceId.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const source = value.source === 'clone' || value.source === 'design' || value.source === 'existing' ? value.source : undefined;
  const createdAt = typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt))
    ? value.createdAt : typeof now === 'function' ? now().toISOString() : undefined;
  if (!voiceId || !name || !source || !createdAt) return undefined;
  const optional = {};
  for (const key of ['description', 'provider']) if (typeof value[key] === 'string' && value[key].trim()) optional[key] = value[key].trim();
  const linkedPackIds = Array.isArray(value.linkedPackIds) ? [...new Set(value.linkedPackIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))].sort() : [];
  return { voiceId, name, source, createdAt, ...(linkedPackIds.length ? { linkedPackIds } : {}), ...optional };
}

export { REGISTRY_FILE };

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generateVoicePackIndex } from './generateVoicePackIndex.mjs';

const SAFE_PACK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const BUILTIN_PACK_IDS = new Set(['xiaozhang']);

export class LocalVoicePackService {
  constructor({ root, masterCsv, now = () => new Date(), sleep = defaultSleep, fileSystem = fs, indexGenerator = generateVoicePackIndex }) {
    this.root = path.resolve(root);
    this.masterCsv = path.resolve(masterCsv);
    this.now = now;
    this.sleep = sleep;
    this.fileSystem = fileSystem;
    this.indexGenerator = indexGenerator;
    this.creating = false;
  }

  async listPacks() {
    try {
      const value = JSON.parse(await fs.readFile(path.join(this.root, 'voice_packs.json'), 'utf8'));
      return Array.isArray(value?.packs) ? value.packs : [];
    } catch { return []; }
  }

  async getPack(packId) {
    assertSafePackId(packId);
    const packDirectory = safeChildPath(this.root, packId);
    const [meta, manifest, voiceLines, generationCache, failed, generationLog] = await Promise.all([
      readJson(path.join(packDirectory, 'pack.json')),
      readJson(path.join(packDirectory, 'manifest.json')),
      readJson(path.join(packDirectory, 'voice_lines.json')),
      readOptionalJson(path.join(packDirectory, '.voice_cache.json'), {}),
      readOptionalJson(path.join(packDirectory, 'failed.json'), []),
      readOptionalJson(path.join(packDirectory, 'generation_log.json'), []),
    ]);
    const voiceAvailability = {};
    for (const [key, entry] of Object.entries(manifest.voices ?? {})) {
      const file = typeof entry?.file === 'string' ? entry.file : '';
      const exists = file && await isValidMp3File(path.join(packDirectory, file));
      voiceAvailability[key] = { key, file, status: exists ? 'available' : 'missing-audio' };
    }
    const failedKeys = [...new Set([
      ...failed.filter((entry) => typeof entry?.key === 'string').map((entry) => entry.key),
      ...generationLog.filter((entry) => entry?.status === 'failed' && typeof entry.key === 'string').map((entry) => entry.key),
    ])];
    return { meta, manifest, voiceLines, voiceAvailability, generationCache, failedKeys, synthesis: { speed: 1, format: 'mp3' } };
  }

  /** Returns a manifest-authorized MP3 path for the dev server; never accepts arbitrary paths. */
  async getAudioFile(packId, filename) {
    assertSafePackId(packId);
    if (typeof filename !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]*\.mp3$/.test(filename)) {
      throw new VoicePackServiceError(400, '音频文件名无效。');
    }
    const packDirectory = safeChildPath(this.root, packId);
    const manifest = await readJson(path.join(packDirectory, 'manifest.json'));
    const allowed = Object.values(manifest?.voices ?? {}).some((entry) => entry?.file === `audio/${filename}`);
    if (!allowed) throw new VoicePackServiceError(404, '未找到语音音频。');
    const file = safeChildPath(path.join(packDirectory, 'audio'), filename);
    try { const stat = await fs.stat(file); if (!stat.isFile()) throw new Error('not file'); return file; }
    catch { throw new VoicePackServiceError(404, '未找到语音音频。'); }
  }

  async createPack(input) {
    if (this.creating) throw new VoicePackServiceError(409, '正在创建角色，请勿重复提交。');
    this.creating = true;
    let temporaryDirectory; let committedDirectory;
    try {
      const normalized = validateInput(input);
      await fs.access(this.masterCsv);
      await fs.mkdir(this.root, { recursive: true });
      const packId = await nextPackId(this.root, normalized.displayName, this.now());
      const destination = safeChildPath(this.root, packId);
      temporaryDirectory = safeChildPath(this.root, `.${packId}.creating-${process.pid}-${Date.now()}`);
      await fs.mkdir(temporaryDirectory, { recursive: false });
      await fs.mkdir(path.join(temporaryDirectory, 'audio'));
      const metadata = {
        id: packId, name: normalized.displayName, locale: normalized.locale, provider: 'fish-audio',
        voiceId: normalized.voiceId, modelId: normalized.modelId, version: 1,
        ...(normalized.ttsControls ? { ttsControls: normalized.ttsControls } : {}),
      };
      await fs.writeFile(path.join(temporaryDirectory, 'pack.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
      await fs.copyFile(this.masterCsv, path.join(temporaryDirectory, 'voice_lines.csv'));
      await fs.writeFile(path.join(temporaryDirectory, 'manifest.json'), `${JSON.stringify({ character: packId, voiceId: normalized.voiceId, voices: {} }, null, 2)}\n`, 'utf8');
      await fs.writeFile(path.join(temporaryDirectory, '.voice_cache.json'), '{}\n', 'utf8');
      await fs.writeFile(path.join(temporaryDirectory, 'generation_log.json'), '[]\n', 'utf8');
      await fs.writeFile(path.join(temporaryDirectory, 'failed.json'), '[]\n', 'utf8');
      await fs.rename(temporaryDirectory, destination);
      temporaryDirectory = undefined;
      committedDirectory = destination;
      await generateVoicePackIndex(this.root);
      if (!(await this.listPacks()).some((pack) => pack.id === packId)) {
        throw new VoicePackServiceError(500, '语音包索引刷新失败，已取消创建。');
      }
      committedDirectory = undefined;
      return { pack: { id: packId, name: normalized.displayName, locale: normalized.locale, path: packId }, lineCount: await countCsvRows(path.join(destination, 'voice_lines.csv')) };
    } catch (error) {
      if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
      if (committedDirectory) await fs.rm(committedDirectory, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    } finally { this.creating = false; }
  }

  /** Deletes a user-created Pack atomically from the local development workspace. */
  async deletePack(packId) {
    assertSafePackId(packId);
    if (BUILTIN_PACK_IDS.has(packId)) throw new VoicePackServiceError(403, '内置角色无法删除。');
    const packDirectory = safeChildPath(this.root, packId);
    try {
      const stat = await this.fileSystem.stat(packDirectory);
      if (!stat.isDirectory()) throw new Error('not directory');
    } catch {
      throw new VoicePackServiceError(404, '要删除的角色语音包不存在。');
    }
    // Keep the rollback directory adjacent to (but outside) voice_lines so the
    // index generator never treats it as a malformed Pack during the refresh.
    const temporaryDirectory = path.join(path.dirname(this.root), `.${path.basename(this.root)}-${packId}.deleting-${process.pid}-${Date.now()}`);
    try {
      await renameWithWindowsRetries(this.fileSystem, packDirectory, temporaryDirectory, this.sleep);
    } catch (error) {
      if (!isWindowsFileLock(error)) throw new VoicePackServiceError(500, '删除角色文件失败，请稍后重试。', 'PACK_DELETE_FAILED');
      // Explorer, antivirus, or a just-stopped Audio element can hold a handle
      // briefly on Windows. Fall back to a retrying recursive remove only after
      // the atomic rename has been given a fair chance.
      try {
        await this.fileSystem.rm(packDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        throw new VoicePackServiceError(423, '角色文件正在被系统或播放器占用，请停止试听后重试。', 'PACK_IN_USE');
      }
      try { await this.indexGenerator(this.root); }
      catch { throw new VoicePackServiceError(500, '角色已删除，但语音包索引刷新失败。', 'PACK_INDEX_REFRESH_FAILED'); }
      return { deletedPackId: packId };
    }
    try {
      await this.indexGenerator(this.root);
      await this.fileSystem.rm(temporaryDirectory, { recursive: true, force: true });
      return { deletedPackId: packId };
    } catch (error) {
      await this.fileSystem.rename(temporaryDirectory, packDirectory).catch(() => undefined);
      await this.indexGenerator(this.root).catch(() => undefined);
      throw error instanceof VoicePackServiceError
        ? error
        : new VoicePackServiceError(500, '删除角色后刷新索引失败，已恢复本地角色。');
    }
  }
}

async function isValidMp3File(file) {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size <= 0) return false;
    const handle = await fs.open(file, 'r');
    try {
      const buffer = Buffer.alloc(3);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      return bytesRead === 3 && (buffer.subarray(0, 3).equals(Buffer.from('ID3')) || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0));
    } finally { await handle.close(); }
  } catch { return false; }
}

async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function readOptionalJson(file, fallback) { try { return await readJson(file); } catch (error) { if (error?.code === 'ENOENT') return fallback; throw error; } }

export class VoicePackServiceError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

const WINDOWS_RENAME_DELAYS = [100, 200, 400, 800, 1200];
async function defaultSleep(delay) { await new Promise((resolve) => setTimeout(resolve, delay)); }
function isWindowsFileLock(error) { return error?.code === 'EPERM' || error?.code === 'EBUSY'; }
export async function renameWithWindowsRetries(fileSystem, from, to, sleep = defaultSleep) {
  let lastError;
  for (let attempt = 0; attempt <= WINDOWS_RENAME_DELAYS.length; attempt += 1) {
    try { await fileSystem.rename(from, to); return; }
    catch (error) {
      lastError = error;
      if (!isWindowsFileLock(error) || attempt === WINDOWS_RENAME_DELAYS.length) throw error;
      await sleep(WINDOWS_RENAME_DELAYS[attempt]);
    }
  }
  throw lastError;
}

function validateInput(input) {
  if (!input || typeof input !== 'object') throw new VoicePackServiceError(400, '创建参数无效。');
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  const voiceId = typeof input.voiceId === 'string' ? input.voiceId.trim() : '';
  const locale = typeof input.locale === 'string' && input.locale.trim() ? input.locale.trim() : 'zh-CN';
  const modelId = typeof input.modelId === 'string' ? input.modelId.trim() : '';
  if (!displayName) throw new VoicePackServiceError(400, '角色名称不能为空。');
  if (displayName.includes('/') || displayName.includes('\\') || displayName.includes('..')) throw new VoicePackServiceError(400, '角色名称不能包含路径字符。');
  if (!voiceId) throw new VoicePackServiceError(400, 'Fish Audio Voice ID 不能为空。');
  if (!modelId) throw new VoicePackServiceError(400, '必须选择一个兼容的 Fish Audio 模型。');
  if (!SAFE_LOCALE.test(locale)) throw new VoicePackServiceError(400, '语言代码无效。');
  const rawControls = input.ttsControls;
  if (rawControls !== undefined && (!rawControls || typeof rawControls !== 'object' || Array.isArray(rawControls))) throw new VoicePackServiceError(400, '模型能力参数无效。');
  const ttsControls = rawControls ? Object.fromEntries(Object.entries(rawControls).filter(([, value]) => typeof value === 'boolean')) : undefined;
  return { displayName, voiceId, locale, modelId, ...(ttsControls ? { ttsControls } : {}) };
}

async function nextPackId(root, displayName, now) {
  const slug = displayName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const base = slug || `voice-${date}`;
  const names = new Set((await fs.readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  for (let suffix = 1; suffix < 10000; suffix += 1) {
    const candidate = `${base}-${String(suffix).padStart(3, '0')}`;
    if (!names.has(candidate)) return candidate;
  }
  throw new VoicePackServiceError(409, '无法生成唯一角色 ID。');
}

function assertSafePackId(packId) {
  if (typeof packId !== 'string' || !SAFE_PACK_ID.test(packId)) throw new VoicePackServiceError(400, '角色 ID 无效。');
}

function safeChildPath(root, name) {
  const candidate = path.resolve(root, name);
  if (path.relative(root, candidate).startsWith('..') || path.isAbsolute(path.relative(root, candidate))) throw new VoicePackServiceError(400, '非法角色路径。');
  return candidate;
}

async function countCsvRows(file) {
  const text = await fs.readFile(file, 'utf8');
  return Math.max(0, text.split(/\r?\n/).filter((line) => line.trim()).length - 1);
}

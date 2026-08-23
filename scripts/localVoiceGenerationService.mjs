import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generateVoicePackIndex } from './generateVoicePackIndex.mjs';
import { VoicePackServiceError } from './localVoicePackService.mjs';

const SAFE_PACK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Dev-only process boundary for the existing Python generator. It never reads or returns credentials. */
export class LocalVoiceGenerationService {
  constructor({ root, generator, pythonCommand = 'python', runProcess: processRunner = runProcess, reindex = generateVoicePackIndex }) {
    this.root = path.resolve(root); this.generator = path.resolve(generator); this.pythonCommand = pythonCommand;
    this.runProcess = processRunner; this.reindex = reindex; this.activePacks = new Set();
  }

  async previewGeneration(packId, keys, overrides) {
    const selected = await this.validateSelection(packId, keys);
    await this.applyOverrides(packId, selected, overrides);
    const response = await this.runGenerator(packId, selected, true);
    return response.plan;
  }

  /** Dev-only CSV write boundary used by the editor; it never starts Python or Fish Audio. */
  async updateVoiceLines(packId, overrides) {
    if (!Array.isArray(overrides) || overrides.length === 0) throw new VoicePackServiceError(400, '语音编辑内容无效。');
    const selected = await this.validateSelection(packId, overrides.map((patch) => isRecord(patch) ? patch.key : ''));
    await this.applyOverrides(packId, selected, overrides);
  }

  async generate(packId, keys, overrides) {
    const selected = await this.validateSelection(packId, keys);
    if (this.activePacks.has(packId)) throw new VoicePackServiceError(409, '该角色语音正在生成，请等待当前任务完成。');
    this.activePacks.add(packId);
    try {
      const plan = await this.previewGeneration(packId, selected, overrides);
      if (plan.apiCalls === 0) return {
        success: true, generated: 0, failed: 0, skipped: plan.total,
        items: plan.items.map((item) => ({ key: item.key, file: item.file, status: 'skipped', error: null })),
      };
      const response = await this.runGenerator(packId, selected, false);
      await this.reindex(this.root);
      return response.result;
    } finally { this.activePacks.delete(packId); }
  }

  async validateSelection(packId, keys) {
    if (typeof packId !== 'string' || !SAFE_PACK_ID.test(packId)) throw new VoicePackServiceError(400, '角色 ID 无效。');
    const packDirectory = safeChildPath(this.root, packId);
    const rows = await readVoiceLines(packDirectory);
    const available = new Set(rows.map((row) => row.key).filter((key) => typeof key === 'string'));
    if (keys === undefined) return undefined;
    if (!Array.isArray(keys) || keys.length === 0 || keys.some((key) => typeof key !== 'string' || !key || key.includes(','))) {
      throw new VoicePackServiceError(400, '语音 key 参数无效。');
    }
    if (new Set(keys).size !== keys.length) throw new VoicePackServiceError(400, '语音 key 不能重复。');
    const unknown = keys.filter((key) => !available.has(key));
    if (unknown.length) throw new VoicePackServiceError(400, '语音 key 不属于当前角色。');
    return keys;
  }

  /** Persist explicitly supplied UI edits to the selected pack only, then refresh its build-time line index. */
  async applyOverrides(packId, selected, overrides) {
    if (overrides === undefined) return;
    if (!Array.isArray(overrides)) throw new VoicePackServiceError(400, '语音编辑参数无效。');
    const packDirectory = safeChildPath(this.root, packId);
    const rows = await readCsvRows(path.join(packDirectory, 'voice_lines.csv'));
    const validKeys = new Set(rows.values.map((row) => row.key));
    const selectedKeys = selected ? new Set(selected) : validKeys;
    const seen = new Set();
    let changed = false;
    for (const patch of overrides) {
      if (!isRecord(patch) || typeof patch.key !== 'string' || !patch.key || seen.has(patch.key) || !validKeys.has(patch.key) || !selectedKeys.has(patch.key)) {
        throw new VoicePackServiceError(400, '语音编辑内容无效。');
      }
      seen.add(patch.key);
      if (patch.line !== undefined && (typeof patch.line !== 'string' || !patch.line.trim())) throw new VoicePackServiceError(400, '台词内容无效。');
      if (patch.ttsText !== undefined && typeof patch.ttsText !== 'string') throw new VoicePackServiceError(400, '高级发音内容无效。');
      const row = rows.values.find((value) => value.key === patch.key);
      if (patch.line !== undefined && row.line !== patch.line) { row.line = patch.line; changed = true; }
      if (patch.ttsText !== undefined && row.tts_text !== patch.ttsText) { row.tts_text = patch.ttsText; changed = true; }
    }
    if (!changed) return;
    await writeCsvRows(path.join(packDirectory, 'voice_lines.csv'), rows);
    await this.reindex(this.root);
  }

  async runGenerator(packId, keys, dryRun) {
    const packDirectory = safeChildPath(this.root, packId);
    const args = [this.generator, '--pack', packDirectory, ...(keys ? ['--keys', keys.join(',')] : []), ...(dryRun ? ['--dry-run'] : []), '--json'];
    const processResult = await this.runProcess(this.pythonCommand, args);
    const payload = parseGeneratorJson(processResult, dryRun ? 'plan' : 'result');
    if (processResult.code !== 0 && payload.kind === 'plan') throw generatorFailure('GENERATOR_EXIT_NONZERO', processResult);
    if (processResult.code !== 0 && payload.result.success) throw generatorFailure('GENERATOR_EXIT_INCONSISTENT', processResult);
    return payload;
  }
}

function safeChildPath(root, name) {
  const candidate = path.resolve(root, name); const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new VoicePackServiceError(400, '非法角色路径。');
  return candidate;
}

async function readVoiceLines(packDirectory) {
  try {
    const value = JSON.parse(await fs.readFile(path.join(packDirectory, 'voice_lines.json'), 'utf8'));
    if (!Array.isArray(value)) throw new Error('invalid');
    return value;
  } catch { throw new VoicePackServiceError(404, '当前角色语音包不可用。'); }
}

async function readCsvRows(file) {
  let text;
  try { text = await fs.readFile(file, 'utf8'); } catch { throw new VoicePackServiceError(404, '当前角色语音台词不可用。'); }
  const records = parseCsv(text.replace(/^\uFEFF/, ''));
  const [headers, ...values] = records;
  if (!headers?.length || !headers.includes('key') || !headers.includes('line') || !headers.includes('tts_text')) throw new VoicePackServiceError(422, '角色语音台词格式无效。');
  const mapped = values.filter((value) => value.some((cell) => cell !== '')).map((value) => Object.fromEntries(headers.map((header, index) => [header, value[index] ?? ''])));
  if (mapped.some((row) => !row.key)) throw new VoicePackServiceError(422, '角色语音台词包含无效 key。');
  return { headers, values: mapped };
}

async function writeCsvRows(file, rows) {
  const body = [rows.headers, ...rows.values.map((row) => rows.headers.map((header) => row[header] ?? ''))]
    .map((record) => record.map(escapeCsvCell).join(',')).join('\r\n');
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, `\uFEFF${body}\r\n`, 'utf8');
  await fs.rename(temporary, file);
}

function parseCsv(text) {
  const records = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) { if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; } else if (character === '"') quoted = false; else cell += character; continue; }
    if (character === '"') { quoted = true; continue; }
    if (character === ',') { row.push(cell); cell = ''; continue; }
    if (character === '\n') { row.push(cell.replace(/\r$/, '')); records.push(row); row = []; cell = ''; continue; }
    cell += character;
  }
  if (cell || row.length) { row.push(cell); records.push(row); }
  return records;
}

function escapeCsvCell(value) { const text = String(value); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }

function parseGeneratorJson(processResult, expectedKind) {
  const stdout = processResult.stdout.replace(/^\uFEFF/, '').trim();
  let payload;
  try { payload = JSON.parse(stdout); } catch { throw generatorFailure('GENERATOR_INVALID_RESPONSE', processResult); }
  if (!isRecord(payload) || payload.kind !== expectedKind) throw generatorFailure('GENERATOR_INVALID_RESPONSE', processResult);
  if (expectedKind === 'plan') {
    if (!isRecord(payload.plan) || !isValidPlan(payload.plan)) throw generatorFailure('GENERATOR_INVALID_RESPONSE', processResult);
    return { kind: 'plan', plan: normalizePlan(payload.plan) };
  }
  if (!isRecord(payload.result) || !isValidResult(payload.result)) throw generatorFailure('GENERATOR_INVALID_RESPONSE', processResult);
  return { kind: 'result', result: normalizeResult(payload.result) };
}

function isValidPlan(value) {
  return typeof value.packId === 'string' && ['total', 'unchanged', 'changed', 'new', 'missing', 'apiCalls'].every((key) => typeof value[key] === 'number') && Array.isArray(value.items);
}
function normalizePlan(value) {
  return { packId: value.packId, total: value.total, unchanged: value.unchanged, changed: value.changed, new: value.new, missing: value.missing, apiCalls: value.apiCalls,
    items: value.items.filter(isRecord).map((item) => ({ key: String(item.key ?? ''), line: String(item.line ?? ''), file: String(item.file ?? ''), status: String(item.status ?? ''), reason: String(item.reason ?? '') })) };
}
function isValidResult(value) {
  return typeof value.success === 'boolean' && ['generated', 'failed', 'skipped'].every((key) => typeof value[key] === 'number')
    && Array.isArray(value.items) && value.items.every((item) => isRecord(item) && typeof item.key === 'string' && typeof item.file === 'string' && typeof item.status === 'string')
    && (value.error === undefined || (isRecord(value.error) && typeof value.error.code === 'string' && typeof value.error.message === 'string'));
}
function normalizeResult(value) {
  return { success: value.success, generated: value.generated, failed: value.failed, skipped: value.skipped,
    items: value.items.map((item) => ({ key: item.key, file: item.file, status: item.status, error: typeof item.error === 'string' ? item.error : null })),
    ...(isRecord(value.error) ? { error: { code: value.error.code, message: value.error.message } } : {}) };
}
function generatorFailure(code, processResult) {
  const diagnostic = { code, exitCode: processResult.code, stdoutBytes: Buffer.byteLength(processResult.stdout, 'utf8'), stderrBytes: Buffer.byteLength(processResult.stderr, 'utf8') };
  // Keep diagnostics server-side and structural: neither stream content nor credentials are logged.
  console.warn('Voice generator diagnostic', diagnostic);
  return new VoicePackServiceError(502, `${code}: 语音生成器响应无效。`);
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject); child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

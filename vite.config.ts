import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { LocalVoicePackService, VoicePackServiceError } from './scripts/localVoicePackService.mjs';
import { LocalVoiceGenerationService } from './scripts/localVoiceGenerationService.mjs';
import { FishAudioModelDiscoveryService, FishDiscoveryError } from './scripts/fishAudioModelDiscovery.mjs';
import { LocalGeneratedVoiceRegistry } from './scripts/localGeneratedVoiceRegistry.mjs';
import { FishVoiceCreationError, FishVoiceCreationService } from './scripts/fishVoiceCreationService.mjs';
import cloneLanguageMapping from './src/audio/voice/fishCloneLanguages.json';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const voiceRoot = path.join(projectRoot, 'src', 'music', 'voice_lines');
const voicePackService = new LocalVoicePackService({ root: voiceRoot, masterCsv: path.join(voiceRoot, 'mahjong_voice_lines.csv') });
const voiceGenerationService = new LocalVoiceGenerationService({ root: voiceRoot, generator: path.join(projectRoot, 'src', 'audio', 'generate_voice.py') });
const fishModelDiscovery = new FishAudioModelDiscoveryService({ projectRoot });
const generatedVoiceRegistry = new LocalGeneratedVoiceRegistry({ root: voiceRoot });
const fishVoiceCreation = new FishVoiceCreationService({ projectRoot, registry: generatedVoiceRegistry });
const cloneLanguageCodes = new Set(cloneLanguageMapping.languages.map((entry) => entry.cloneLanguage));

function localVoiceBridge(): Plugin {
  return {
    name: 'local-voice-pack-bridge',
    configureServer(server) {
      // Creation endpoints are development-only, bound to loopback by the Vite
      // config below, and require an exact local same-origin POST request.
      server.middlewares.use('/api/generated-voices', async (request, response, next) => {
        try {
          const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
          if (!isLocalBridgeHost(request.headers.host)) return sendJson(response, 403, { error: '本地语音创建服务只允许本机访问。' });
          if (request.method === 'POST' && !isLocalSameOrigin(request.headers.origin, request.headers.host)) return sendJson(response, 403, { error: '本地语音创建服务拒绝非同源请求。' });
          if (request.method === 'GET' && pathname === '/') return sendJson(response, 200, { voices: await generatedVoiceRegistry.list() });
          const cloudDelete = pathname.match(/^\/([A-Za-z0-9_-]+)\/cloud$/);
          if (request.method === 'DELETE' && cloudDelete) {
            const voiceId = decodeURIComponent(cloudDelete[1]); const entry = await generatedVoiceRegistry.get(voiceId);
            if (!entry) return sendJson(response, 404, { code: 'VOICE_NOT_FOUND', error: '本地音色记录不存在。' });
            if (entry.source === 'existing' || entry.linkedPackIds?.length) return sendJson(response, 409, { code: 'VOICE_IN_USE', error: '该音色正在被角色使用，不能删除。' });
            await fishVoiceCreation.deleteVoice(voiceId); await generatedVoiceRegistry.remove(voiceId); return sendJson(response, 200, { removed: true });
          }
          if (request.method === 'DELETE' && /^\/[A-Za-z0-9_-]+$/.test(pathname)) {
            const voiceId = decodeURIComponent(pathname.slice(1)); const entry = await generatedVoiceRegistry.get(voiceId);
            if (entry?.source === 'existing' || entry?.linkedPackIds?.length) return sendJson(response, 409, { code: 'VOICE_IN_USE', error: '该音色正在被角色使用，不能移除。' });
            return sendJson(response, 200, { removed: await generatedVoiceRegistry.remove(voiceId) });
          }
          if (request.method === 'POST' && pathname === '/clone') return sendJson(response, 201, { voice: await fishVoiceCreation.cloneVoice(await readMultipartBody(request)) });
          const clonePreview = pathname.match(/^\/([A-Za-z0-9_-]+)\/preview$/);
          if (request.method === 'POST' && clonePreview) {
            const body = await readJsonBody(request);
            if (!isRecord(body)) throw new FishVoiceCreationError('INVALID_REQUEST', '试听请求无效。', 400);
            const result = await fishVoiceCreation.previewVoice({ ...body, voiceId: decodeURIComponent(clonePreview[1]) });
            response.statusCode = 200; response.setHeader('Content-Type', result.contentType); response.setHeader('Cache-Control', 'no-store'); response.end(result.bytes); return;
          }
          if (request.method === 'POST' && pathname === '/designs') return sendJson(response, 201, { design: await fishVoiceCreation.createDesign(await readJsonBody(request)) });
          const audio = pathname.match(/^\/designs\/([^/]+)\/candidates\/([^/]+)\/audio$/);
          if (request.method === 'GET' && audio) {
            const result = await fishVoiceCreation.candidateAudio(decodeURIComponent(audio[1]), decodeURIComponent(audio[2]));
            response.statusCode = 200; response.setHeader('Content-Type', result.contentType); response.setHeader('Cache-Control', 'no-store'); response.end(result.bytes); return;
          }
          const save = pathname.match(/^\/designs\/([^/]+)\/voices$/);
          if (request.method === 'POST' && save) return sendJson(response, 201, { voice: await fishVoiceCreation.saveDesignVoice(decodeURIComponent(save[1]), await readJsonBody(request)) });
          return sendJson(response, 404, { error: '未找到音色创建接口。' });
        } catch (error) {
          if (error instanceof FishVoiceCreationError) return sendJson(response, error.status, { error: error.message, code: error.code });
          if (error instanceof VoicePackServiceError) return sendJson(response, error.status, { error: error.message, code: 'LOCAL_BRIDGE_REQUEST' });
          return sendJson(response, 500, { error: '本地音色创建服务处理请求失败，请重试。', code: 'LOCAL_BRIDGE_ERROR' });
        }
      });
      server.middlewares.use('/api/voice-models', async (request, response, next) => {
        try {
          const url = new URL(request.url ?? '/', 'http://localhost');
          if (request.method !== 'GET' || url.pathname !== '/') return sendJson(response, 404, { error: '未找到模型发现接口。' });
          return sendJson(response, 200, { discovery: await fishModelDiscovery.discover(url.searchParams.get('voiceId')) });
        } catch (error) {
          if (error instanceof FishDiscoveryError) return sendJson(response, error.status, { error: error.message, code: error.code });
          return next(error);
        }
      });
      server.middlewares.use('/api/voice-packs', async (request, response, next) => {
        try {
          const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
          const audioMatch = pathname.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/audio\/([A-Za-z0-9][A-Za-z0-9_.-]*\.mp3)$/);
          if (request.method === 'GET' && audioMatch) {
            const file = await voicePackService.getAudioFile(audioMatch[1], audioMatch[2]);
            response.statusCode = 200; response.setHeader('Content-Type', 'audio/mpeg'); response.end(await fs.readFile(file));
            return;
          }
          const editMatch = pathname.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/voice-lines$/);
          if (request.method === 'POST' && editMatch) {
            const body = await readJsonBody(request);
            const overrides = isRecord(body) ? body.overrides : undefined;
            await voiceGenerationService.updateVoiceLines(editMatch[1], overrides);
            return sendJson(response, 200, { pack: await voicePackService.getPack(editMatch[1]) });
          }
          const generationMatch = pathname.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(generation-plan|generate)$/);
          if (request.method === 'POST' && generationMatch) {
            const [, packId, operation] = generationMatch;
            const body = await readJsonBody(request);
            const keys = isRecord(body) && body.keys !== undefined ? body.keys : undefined;
            const overrides = isRecord(body) && body.overrides !== undefined ? body.overrides : undefined;
            const value = operation === 'generation-plan'
              ? { plan: await voiceGenerationService.previewGeneration(packId, keys, overrides) }
              : { result: await voiceGenerationService.generate(packId, keys, overrides) };
            return sendJson(response, 200, value);
          }
          if (request.method === 'GET' && pathname === '/') return sendJson(response, 200, { packs: await voicePackService.listPacks() });
          if (request.method === 'GET' && /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname)) return sendJson(response, 200, { pack: await voicePackService.getPack(pathname.slice(1)) });
          if (request.method === 'POST' && pathname === '/') {
            const input = await readJsonBody(request);
            if (!isRecord(input) || typeof input.voiceId !== 'string' || typeof input.modelId !== 'string') {
              throw new VoicePackServiceError(400, '创建参数无效。');
            }
            const discovery = await fishModelDiscovery.discover(input.voiceId);
            if (!discovery.compatibleModels.some((model) => model.modelId === input.modelId)) {
              throw new VoicePackServiceError(422, '所选模型当前不兼容或不可用。');
            }
            const selectedModel = discovery.compatibleModels.find((model) => model.modelId === input.modelId);
            const created = await voicePackService.createPack({ ...input, ttsControls: selectedModel?.controls });
            sendJson(response, 201, created);
            return;
          }
          if (request.method === 'DELETE' && /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname)) {
            return sendJson(response, 200, await voicePackService.deletePack(pathname.slice(1)));
          }
          return sendJson(response, 404, { error: '未找到语音包接口。' });
        } catch (error) {
          if (error instanceof VoicePackServiceError) return sendJson(response, error.status, { error: error.message, ...(error.code ? { code: error.code } : {}) });
          if (error instanceof FishDiscoveryError) return sendJson(response, error.status, { error: error.message, code: error.code });
          // The local filesystem can reject a Windows rename with an opaque
          // error. Never pass that to Vite's error overlay: the UI needs a
          // normal, recoverable API response and must keep the Pack listed.
          return sendJson(response, 500, { code: 'PACK_DELETE_FAILED', error: '本地角色语音服务处理请求失败，请稍后重试。' });
        }
      });
    },
  };
}

function readJsonBody(request: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 16_384) reject(new VoicePackServiceError(413, '请求内容过大。'));
    });
    request.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new VoicePackServiceError(400, '请求 JSON 无效。')); } });
    request.on('error', reject);
  });
}

/** Multipart is parsed in memory only; uploaded reference audio is never written to disk. */
async function readMultipartBody(request: import('node:http').IncomingMessage): Promise<{ name?: string; description?: string; referenceText?: string; languages: string[]; audioFiles: File[] }> {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.startsWith('multipart/form-data')) throw new VoicePackServiceError(400, '参考音频请求格式无效。');
  const length = Number(request.headers['content-length']);
  if (Number.isFinite(length) && length > 50 * 1024 * 1024) throw new VoicePackServiceError(413, '上传参考音频总大小不能超过 50MB。');
  let received = 0;
  const body = (Readable.toWeb(request) as ReadableStream<Uint8Array>).pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) {
    received += chunk.byteLength;
    if (received > 50 * 1024 * 1024) throw new VoicePackServiceError(413, '上传参考音频总大小不能超过 50MB。');
    controller.enqueue(chunk);
  } }));
  const webRequest = new Request('http://127.0.0.1/api/generated-voices/clone', { method: 'POST', headers: { 'Content-Type': contentType }, body, duplex: 'half' });
  const form = await webRequest.formData();
  const files = form.getAll('audioFiles').filter((value): value is File => value instanceof File);
  const rawLanguages = form.get('languages'); let languages: unknown;
  try { languages = typeof rawLanguages === 'string' ? JSON.parse(rawLanguages) : undefined; } catch { throw new VoicePackServiceError(400, '音色语言格式无效。'); }
  if (!Array.isArray(languages) || languages.length !== 1 || typeof languages[0] !== 'string' || !cloneLanguageCodes.has(languages[0])) {
    throw new VoicePackServiceError(400, '请明确选择一个受支持的音色语言。');
  }
  return { name: form.get('name')?.toString(), description: form.get('description')?.toString(), referenceText: form.get('referenceText')?.toString(), languages, audioFiles: files };
}

function sendJson(response: import('node:http').ServerResponse, status: number, value: unknown): void {
  response.statusCode = status; response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.end(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isLocalBridgeHost(host: string | undefined): boolean {
  if (!host) return false;
  try { const url = new URL(`http://${host}`); return (url.hostname === '127.0.0.1' || url.hostname === 'localhost') && Boolean(url.port); }
  catch { return false; }
}
function isLocalSameOrigin(origin: string | undefined, host: string | undefined): boolean { return Boolean(origin && host && (origin === `http://${host}` || origin === `https://${host}`) && isLocalBridgeHost(host)); }

// Generation data is mutable at runtime and is read through the local Bridge.
// Do not let its writes reset React state through Vite HMR/full reload.
const runtimeVoicePackFiles = [
  '**/src/music/voice_lines/voice_packs.json',
  '**/src/music/voice_lines/*/voice_lines.json',
  '**/src/music/voice_lines/*/voice_lines.csv',
  '**/src/music/voice_lines/*/pack.json',
  '**/src/music/voice_lines/*/manifest.json',
  '**/src/music/voice_lines/*/.voice_cache.json',
  '**/src/music/voice_lines/*/generation_log.json',
  '**/src/music/voice_lines/*/failed.json',
  '**/src/music/voice_lines/*/voice_key_report.json',
  '**/src/music/voice_lines/*/audio/**/*.mp3',
  '**/src/music/voice_lines/generated_voices.json',
];

export default defineConfig({ plugins: [react(), localVoiceBridge()], server: { host: '127.0.0.1', watch: { ignored: runtimeVoicePackFiles } } });

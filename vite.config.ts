import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { LocalVoicePackService, VoicePackServiceError } from './scripts/localVoicePackService.mjs';
import { LocalVoiceGenerationService } from './scripts/localVoiceGenerationService.mjs';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const voiceRoot = path.join(projectRoot, 'src', 'music', 'voice_lines');
const voicePackService = new LocalVoicePackService({ root: voiceRoot, masterCsv: path.join(voiceRoot, 'mahjong_voice_lines.csv') });
const voiceGenerationService = new LocalVoiceGenerationService({ root: voiceRoot, generator: path.join(projectRoot, 'src', 'audio', 'generate_voice.py') });

function localVoiceBridge(): Plugin {
  return {
    name: 'local-voice-pack-bridge',
    configureServer(server) {
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
            const created = await voicePackService.createPack(await readJsonBody(request));
            sendJson(response, 201, created);
            return;
          }
          if (request.method === 'DELETE' && /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname)) {
            return sendJson(response, 200, await voicePackService.deletePack(pathname.slice(1)));
          }
          return sendJson(response, 404, { error: '未找到语音包接口。' });
        } catch (error) {
          if (error instanceof VoicePackServiceError) return sendJson(response, error.status, { error: error.message });
          return next(error);
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

function sendJson(response: import('node:http').ServerResponse, status: number, value: unknown): void {
  response.statusCode = status; response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.end(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

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
];

export default defineConfig({ plugins: [react(), localVoiceBridge()], server: { watch: { ignored: runtimeVoicePackFiles } } });

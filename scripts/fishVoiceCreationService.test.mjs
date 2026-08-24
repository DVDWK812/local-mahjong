import { expect, it } from 'vitest';
import { FishVoiceCreationService, validateCloneInput } from './fishVoiceCreationService.mjs';

function response(value, status = 200, headers = { 'content-type': 'application/json' }) { return new Response(status === 200 && value instanceof Uint8Array ? value : JSON.stringify(value), { status, headers }); }
function file(name = 'sample.mp3', size = 4, type = 'audio/mpeg') { return new File([new Uint8Array(size)], name, { type }); }

it('clone uses multipart, idempotency, and saves only normalized permanent voice', async () => {
  const saved = []; let request;
  const service = new FishVoiceCreationService({ registry: { upsert: async (value) => { saved.push(value); return { ...value, createdAt: '2026-08-25T00:00:00.000Z' }; } }, keyLoader: async () => ['secret-never-returned'], randomId: () => 'request-1', fetchImpl: async (_url, init) => { request = init; return response({ voice: { id: 'voice-1', name: '克隆声' } }); } });
  const voice = await service.cloneVoice({ name: '克隆声', audioFiles: [file()] });
  expect(request.method).toBe('POST'); expect(request.headers.Authorization).toBe('Bearer secret-never-returned'); expect(request.headers['Idempotency-Key']).toBe('request-1'); expect(request.body).toBeInstanceOf(FormData);
  expect(voice.voiceId).toBe('voice-1'); expect(saved).toHaveLength(1); expect(saved[0].source).toBe('clone');
});

it('design candidates do not enter registry until a selected candidate is saved', async () => {
  const saved = []; const requests = [];
  const service = new FishVoiceCreationService({ registry: { upsert: async (value) => { saved.push(value); return { ...value, createdAt: '2026-08-25T00:00:00.000Z' }; } }, keyLoader: async () => ['key'], randomId: () => 'request-2', fetchImpl: async (url, init) => { requests.push({ url, init }); return url.endsWith('/voice-designs') ? response({ id: 'design-1', candidates: [{ id: 'candidate-1', provider: 'fishaudio' }] }) : response({ voiceId: 'voice-design-1', name: '设计声' }); } });
  const design = await service.createDesign({ prompt: '冷静少女', previewText: '你好', providers: ['fishaudio'] });
  expect(design.candidates[0].candidateId).toBe('candidate-1'); expect(saved).toHaveLength(0);
  await service.saveDesignVoice(design.designId, { candidateId: 'candidate-1', name: '设计声' });
  expect(saved).toHaveLength(1); expect(saved[0].source).toBe('design'); expect(requests[0].init.headers['Idempotency-Key']).toBe('request-2');
});

it('validation rejects invalid or oversized uploads before any network request', () => {
  expect(() => validateCloneInput({ name: 'x', audioFiles: [] })).toThrow();
  expect(() => validateCloneInput({ name: 'x', audioFiles: [{ name: 'bad.txt', size: 2, type: 'text/plain' }] })).toThrow();
  expect(() => validateCloneInput({ name: 'x', audioFiles: [{ name: 'big.mp3', size: 10 * 1024 * 1024 + 1, type: 'audio/mpeg' }] })).toThrow();
});

it('ambiguous POST network error is not retried', async () => {
  let calls = 0; const service = new FishVoiceCreationService({ registry: { upsert: async (value) => value }, keyLoader: async () => ['key'], fetchImpl: async () => { calls += 1; throw new Error('network'); } });
  await expect(service.cloneVoice({ name: 'x', audioFiles: [file()] })).rejects.toThrow('结果不确定'); expect(calls).toBe(1);
});

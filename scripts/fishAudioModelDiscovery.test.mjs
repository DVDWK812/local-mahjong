import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FishAudioModelDiscoveryService, normalizeDiscovery } from './fishAudioModelDiscovery.mjs';

const temporaryRoots = [];
const controls = { speed: true, volume: true, pitch: false, stability: true, similarity: true, language: false, textNormalization: true, emotion: false, instruction: false };
const capabilities = (models = [
  { modelId: 'fishaudio-s21pro-flash', displayName: 'S2.1 Pro Flash', available: true, controls },
  { modelId: 'model-b', displayName: 'Model B', available: false, controls },
], recommendedModelId = 'fishaudio-s21pro-flash') => ({ models, recommendedModelId });
function response(status, value) { return { ok: status >= 200 && status < 300, status, json: async () => value }; }
async function fixture(fetchImpl) {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mahjong-fish-discovery-')); temporaryRoots.push(projectRoot);
  await fs.mkdir(path.join(projectRoot, '.secrets')); await fs.writeFile(path.join(projectRoot, '.secrets', 'fish_audio_api_keys.txt'), 'test-key\n', 'utf8');
  return new FishAudioModelDiscoveryService({ projectRoot, fetchImpl, cacheTtlMs: 60_000 });
}
afterEach(async () => { await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe('FishAudioModelDiscoveryService', () => {
  it('uses v3 Voice modelIds ∩ v3 capabilities available models, without leaking secrets', async () => {
    const service = await fixture(async (url) => String(url).includes('/voices/')
      ? response(200, { voiceId: 'voice-abc', name: 'Test', modelIds: ['fishaudio-s21pro-flash', 'model-b'], primaryLanguage: 'zh-CN', languages: ['zh-CN'], accountToken: 'must-not-leak' })
      : response(200, capabilities()));
    const result = await service.discover('voice-abc');
    expect(result.compatibleModels.map((model) => model.modelId)).toEqual(['fishaudio-s21pro-flash']);
    expect(result.voiceCompatibleModelIds).toEqual(['fishaudio-s21pro-flash', 'model-b']);
    expect(JSON.stringify(result)).not.toContain('test-key');
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('reports no compatible models without substituting a legacy model', () => {
    const result = normalizeDiscovery('voice-abc', { voiceId: 'voice-abc', modelIds: ['model-x'] }, { models: [{ modelId: 'fishaudio-s21pro-flash', displayName: 'S2.1 Pro Flash', available: true, controls }], recommendedModelId: 'fishaudio-s21pro-flash' });
    expect(result.compatibleModels).toEqual([]);
    expect(result.availableModels.map((model) => model.modelId)).not.toContain('s2.1-pro');
  });

  it('normalizes v3 per-model controls, including stability and similarity', async () => {
    const service = await fixture(async (url) => String(url).includes('/voices/')
      ? response(200, { voiceId: 'voice-abc', modelIds: ['fishaudio-s21pro-flash'] }) : response(200, capabilities()));
    const result = await service.discover('voice-abc');
    expect(result.recommendedModelId).toBe('fishaudio-s21pro-flash');
    expect(result.compatibleModels[0].controls).toMatchObject({ speed: true, volume: true, textNormalization: true, stability: true, similarity: true, language: false });
  });

  it('keeps an existing v3 Pack model valid and uses no legacy endpoint or model namespace', async () => {
    const calls = [];
    const service = await fixture(async (url, init) => {
      calls.push([String(url), init?.headers?.Authorization]);
      return String(url).includes('/voices/') ? response(200, { voiceId: 'voice-abc', modelIds: ['fishaudio-s21pro-flash'] }) : response(200, capabilities());
    });
    await expect(service.discover('voice-abc')).resolves.toMatchObject({ compatibleModels: [expect.objectContaining({ modelId: 'fishaudio-s21pro-flash' })] });
    expect(calls.some(([url]) => url.includes('/model/') || url.includes('openapi.json') || url.includes('/v1/tts'))).toBe(false);
    expect(calls.some(([url]) => url.includes('/api/open/v3/voices/voice-abc'))).toBe(true);
    expect(calls.some(([url]) => url.includes('/api/open/v3/speech/tts/capabilities'))).toBe(true);
  });
});

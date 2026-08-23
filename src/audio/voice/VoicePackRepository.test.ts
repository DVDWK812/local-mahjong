import { describe, expect, it } from 'vitest';
import { VOICE_PACK_REPOSITORY, VoicePackRepository } from './VoicePackRepository';
import type { VoicePackRepositorySources } from './VoicePackRepository';

const root = '../../music/voice_lines/xiaozhang';
const summary = { id: 'xiaozhang', name: '校长', locale: 'zh-CN', path: 'xiaozhang' };
const metadata = { id: 'xiaozhang', name: '校长', locale: 'zh-CN', voiceId: 'voice-1', modelId: 'model-1' };
const manifest = { character: 'xiaozhang', voiceId: 'voice-1', voices: { 'action.riichi': { file: 'audio/action_riichi.mp3' } } };
const lines = [{ key: 'action.riichi', category: 'action', action: 'riichi', line: '立直', tts_text: '立直', locale: 'zh-CN', character: 'xiaozhang', emotion: 'firm' }];

function sources(overrides: Partial<VoicePackRepositorySources> = {}): VoicePackRepositorySources {
  return {
    index: { schemaVersion: 1, packs: [summary] },
    packMetadata: { [`${root}/pack.json`]: metadata },
    manifests: { [`${root}/manifest.json`]: manifest },
    voiceLines: { [`${root}/voice_lines.json`]: lines },
    audio: { [`${root}/audio/action_riichi.mp3`]: '/assets/action_riichi.mp3' },
    ...overrides,
  };
}

describe('VoicePackRepository', () => {
  it('discovers the generated xiaozhang Pack with production-safe audio URLs', () => {
    expect(VOICE_PACK_REPOSITORY.listPacks()).toContainEqual(expect.objectContaining({ id: 'xiaozhang', name: '校长', locale: 'zh-CN' }));
    expect(VOICE_PACK_REPOSITORY.getPack('xiaozhang')?.voiceLines).toHaveLength(114);
    expect(VOICE_PACK_REPOSITORY.getPack('xiaozhang')?.manifest.voices['action.riichi']?.file).toBe('audio/action_riichi.mp3');
    expect(VOICE_PACK_REPOSITORY.getVoiceLine('xiaozhang', 'action.riichi')).toMatchObject({ line: '立直', tts_text: '立直' });
    expect(VOICE_PACK_REPOSITORY.getAudioForKey('xiaozhang', 'action.riichi')).toMatch(/action_riichi.*\.mp3|\.mp3.*action_riichi/);
  });

  it('returns undefined safely for unknown Pack IDs and keys', () => {
    const repository = new VoicePackRepository(sources());
    expect(repository.getPack('unknown')).toBeUndefined();
    expect(repository.getVoiceLine('xiaozhang', 'unknown.key')).toBeUndefined();
    expect(repository.getAudioForKey('xiaozhang', 'unknown.key')).toBeUndefined();
  });

  it('accepts empty tts_text as the canonical default-pronunciation fallback', () => {
    const repository = new VoicePackRepository(sources({
      voiceLines: { [`${root}/voice_lines.json`]: [{ ...lines[0], tts_text: '' }] },
    }));
    expect(repository.getVoiceLine('xiaozhang', 'action.riichi')).toMatchObject({ line: '立直', tts_text: '' });
  });

  it('keeps the first valid Pack and reports duplicate pack IDs', () => {
    const repository = new VoicePackRepository(sources({ index: { schemaVersion: 1, packs: [summary, { ...summary, path: 'duplicate' }] } }));
    expect(repository.listPacks()).toHaveLength(1);
    expect(repository.getDiagnostics()).toContainEqual(expect.objectContaining({ code: 'duplicate-pack-id', packId: 'xiaozhang' }));
  });

  it('skips malformed Packs without preventing other Packs from loading', () => {
    const repository = new VoicePackRepository(sources({
      index: { schemaVersion: 1, packs: [summary, { id: 'broken', name: '损坏', locale: 'zh-CN', path: 'broken' }] },
      packMetadata: { [`${root}/pack.json`]: metadata, '../../music/voice_lines/broken/pack.json': { id: 'broken' } },
    }));
    expect(repository.listPacks()).toEqual([summary]);
    expect(repository.getPack('broken')).toBeUndefined();
    expect(repository.getDiagnostics()).toContainEqual(expect.objectContaining({ code: 'invalid-pack-metadata', packId: 'broken' }));
  });

  it('reports a missing manifest MP3 but preserves the Pack and its other data', () => {
    const repository = new VoicePackRepository(sources({ audio: {} }));
    expect(repository.getPack('xiaozhang')?.voiceAvailability['action.riichi']).toMatchObject({ status: 'missing-audio' });
    expect(repository.getAudioForKey('xiaozhang', 'action.riichi')).toBeUndefined();
    expect(repository.getDiagnostics()).toContainEqual(expect.objectContaining({ code: 'missing-audio', key: 'action.riichi' }));
  });

  it('skips invalid manifest entries and does not throw for extra audio assets', () => {
    const repository = new VoicePackRepository(sources({
      manifests: { [`${root}/manifest.json`]: { ...manifest, voices: { 'action.riichi': { file: 'outside.mp3' } } } },
      audio: { [`${root}/audio/action_riichi.mp3`]: '/assets/action_riichi.mp3', [`${root}/audio/extra.mp3`]: '/assets/extra.mp3' },
    }));
    expect(repository.getAudioForKey('xiaozhang', 'action.riichi')).toBeUndefined();
    expect(repository.getDiagnostics()).toContainEqual(expect.objectContaining({ code: 'invalid-manifest', key: 'action.riichi' }));
    expect(repository.getDiagnostics()).toContainEqual(expect.objectContaining({ code: 'orphan-audio', packId: 'xiaozhang' }));
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreatedVoiceService, validateBrowserFiles } from './CreatedVoiceService';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

describe('CreatedVoiceService', () => {
  it('uses only the local bridge and does not attach Fish authorization in browser requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ voice: { voiceId: 'voice-1', name: '克隆', source: 'clone', createdAt: '2026-08-25T00:00:00.000Z' } }), { status: 201 }));
    globalThis.fetch = fetchMock;
    const file = new File(['audio'], 'voice.mp3', { type: 'audio/mpeg' });
    await new CreatedVoiceService().clone({ name: '克隆', audioFiles: [file] });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/generated-voices/clone');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('validates local files before the bridge request', () => {
    expect(() => validateBrowserFiles([])).toThrow('至少上传');
    expect(() => validateBrowserFiles([new File(['x'], 'bad.txt', { type: 'text/plain' })])).toThrow('格式不支持');
  });

  it('normalizes a design candidate result without putting temporary candidates in the registry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ design: { designId: 'design-1', candidates: [{ candidateId: 'candidate-1', provider: 'fishaudio', label: '候选 1' }] } }), { status: 201 }));
    globalThis.fetch = fetchMock;
    await expect(new CreatedVoiceService().createDesign({ prompt: '冷静', previewText: '你好', providers: ['fishaudio'] })).resolves.toMatchObject({ designId: 'design-1' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/generated-voices/designs');
  });
});

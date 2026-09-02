import { describe, expect, it, vi } from 'vitest';
import { tableRendererUrlBanner, tableRendererUrls } from './tableRendererUrlBanner';

describe('table renderer development URL banner', () => {
  it('derives the 3D query URL from the actual Vite local URL', () => {
    expect(tableRendererUrls('http://127.0.0.1:5174/')).toEqual({
      legacy: 'http://127.0.0.1:5174/',
      threeDimensional: 'http://127.0.0.1:5174/?table3d=1',
    });
  });

  it('prints both renderer URLs and preserves the default fallback', () => {
    const info = vi.fn();
    const printUrls = vi.fn();
    const server = {
      config: { logger: { info } },
      printUrls,
      resolvedUrls: { local: ['http://127.0.0.1:5173/'], network: [] },
    };
    const plugin = tableRendererUrlBanner();
    const configureServer = plugin.configureServer;
    if (typeof configureServer !== 'function') throw new Error('configureServer hook missing');
    configureServer(server as never);

    server.printUrls();

    expect(info).toHaveBeenNthCalledWith(1, '  ➜  Local 2.5D:   http://127.0.0.1:5173/');
    expect(info).toHaveBeenNthCalledWith(2, '  ➜  Local 3D:     http://127.0.0.1:5173/?table3d=1');
    expect(info).toHaveBeenNthCalledWith(3, '  ➜  press h + enter to show help');
    expect(printUrls).not.toHaveBeenCalled();

    server.resolvedUrls = { local: [], network: [] };
    server.printUrls();
    expect(printUrls).toHaveBeenCalledOnce();
  });
});

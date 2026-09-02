import type { Plugin, ViteDevServer } from 'vite';

export function tableRendererUrlBanner(): Plugin {
  return {
    name: 'table-renderer-url-banner',
    configureServer(server) {
      const printDefaultUrls = server.printUrls.bind(server);
      server.printUrls = () => printTableRendererUrls(server, printDefaultUrls);
    },
  };
}

export function tableRendererUrls(localUrl: string): Readonly<{
  legacy: string;
  threeDimensional: string;
}> {
  const threeDimensional = new URL(localUrl);
  threeDimensional.searchParams.set('table3d', '1');
  return { legacy: localUrl, threeDimensional: threeDimensional.toString() };
}

function printTableRendererUrls(server: ViteDevServer, printDefaultUrls: () => void): void {
  const localUrls = server.resolvedUrls?.local;
  if (!localUrls?.length) {
    printDefaultUrls();
    return;
  }

  for (const localUrl of localUrls) {
    const urls = tableRendererUrls(localUrl);
    server.config.logger.info(`  ➜  Local 2.5D:   ${urls.legacy}`);
    server.config.logger.info(`  ➜  Local 3D:     ${urls.threeDimensional}`);
  }
  server.config.logger.info('  ➜  press h + enter to show help');
}

export type TableRendererMode = '2d' | '3d';

export function resolveTableRenderer(search = ''): TableRendererMode {
  return new URLSearchParams(search).get('table3d') === '1' ? '3d' : '2d';
}

export function shouldRender3DTable(mode: TableRendererMode, failed: boolean): boolean {
  return mode === '3d' && !failed;
}

export type TableRendererMode = '2d' | '3d';

/** A saved explicit renderer preference, if a settings surface stores one; absence means the 3D default. */
export const TABLE_RENDERER_PREFERENCE_KEY = 'mahjong.table-renderer-mode';

type RendererStorage = Pick<Storage, 'getItem'>;

function getBrowserStorage(): RendererStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getStoredTableRendererPreference(storage: RendererStorage | null = getBrowserStorage()): TableRendererMode | null {
  try {
    const value = storage?.getItem(TABLE_RENDERER_PREFERENCE_KEY);
    return value === '2d' || value === '3d' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Explicit URL choices are shareable and take precedence over a saved choice.
 * `?table3d=1` remains compatible with existing links; `?table3d=0` opens
 * Legacy Compatibility Mode.
 */
export function resolveTableRenderer(
  search = '',
  storage: RendererStorage | null = getBrowserStorage(),
): TableRendererMode {
  const table3d = new URLSearchParams(search).get('table3d');
  if (table3d === '1') return '3d';
  if (table3d === '0') return '2d';
  return getStoredTableRendererPreference(storage) ?? '3d';
}

export function shouldRender3DTable(mode: TableRendererMode, failed: boolean): boolean {
  return mode === '3d' && !failed;
}

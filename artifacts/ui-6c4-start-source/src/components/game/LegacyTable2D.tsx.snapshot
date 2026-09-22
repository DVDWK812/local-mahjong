import type { ComponentProps } from 'react';
import { MahjongTable } from './MahjongTable';

export type LegacyTable2DProps = ComponentProps<typeof MahjongTable>;

/**
 * Frozen UI-4 table boundary. This component must not add a DOM wrapper because
 * the legacy perspective and table-edge styles intentionally target a direct
 * child of GameScreen / ReplayTableShell.
 */
export function LegacyTable2D(props: LegacyTable2DProps) {
  return <MahjongTable {...props} />;
}

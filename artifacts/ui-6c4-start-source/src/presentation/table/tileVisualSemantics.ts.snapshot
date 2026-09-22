import { getDoraGlowClass, type DoraGlowClass } from '../../game/doraVisual';
import type { Tile, TileId } from '../../game/types';

export type TileDoraVisualKind = Exclude<DoraGlowClass, null>;

export type TileVisualSemantics = Readonly<{
  hoveredMatch: boolean;
  dimmedByHoveredMatch: boolean;
  doraHighlight: boolean;
  redDoraHighlight: boolean;
  combinedHighlight: boolean;
}>;

export type TileVisualSemanticContext = Readonly<{
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  doraGlowEnabled?: boolean;
}>;

export const EMPTY_TILE_VISUAL_SEMANTICS: TileVisualSemantics = {
  hoveredMatch: false,
  dimmedByHoveredMatch: false,
  doraHighlight: false,
  redDoraHighlight: false,
  combinedHighlight: false,
};

export function resolveTileDoraVisualKind(
  tile: Tile | undefined,
  indicators: readonly Tile[],
): TileDoraVisualKind | null {
  return getDoraGlowClass(tile, [...indicators], true);
}

export function resolveTileVisualSemantics({
  tileId,
  faceUp,
  doraKind,
  context,
}: Readonly<{
  tileId?: TileId;
  faceUp: boolean;
  doraKind?: TileDoraVisualKind | null;
  context?: TileVisualSemanticContext;
}>): TileVisualSemantics {
  if (!faceUp || tileId === undefined) return EMPTY_TILE_VISUAL_SEMANTICS;

  const hoveredMatch = context?.sameTileHoverEnabled === true
    && context.hoveredTileType === tileId;
  const doraEnabled = context?.doraGlowEnabled === true;
  const doraHighlight = doraEnabled
    && (doraKind === 'tile--dora' || doraKind === 'tile--double-dora');
  const redDoraHighlight = doraEnabled
    && (doraKind === 'tile--red-dora' || doraKind === 'tile--double-dora');

  return {
    hoveredMatch,
    dimmedByHoveredMatch: hoveredMatch,
    doraHighlight,
    redDoraHighlight,
    combinedHighlight: doraHighlight && redDoraHighlight,
  };
}

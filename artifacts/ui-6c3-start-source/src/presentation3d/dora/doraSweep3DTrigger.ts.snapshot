import {
  resolveTileVisualSemantics,
  type TileVisualSemanticContext,
} from '../../presentation/table/tileVisualSemantics';
import type { ActiveTableAnimation3D } from '../animation/HandAction3D';
import type { TableSceneState, TableSceneTile } from '../sceneState/tableSceneTypes';
import { TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import type { DoraSweep3DTarget, DoraSweep3DTrigger } from './DoraSweep3DController';

export function resolveDoraSweep3DTrigger(
  active: ActiveTableAnimation3D | null,
  sceneState: TableSceneState,
  visualContext?: TileVisualSemanticContext,
): DoraSweep3DTrigger | null {
  if (
    TABLE_PRESENTATION_TUNING.doraSweep3D.enabled !== 1
    || TABLE_PRESENTATION_TUNING.doraVisual.breathingEnabled !== 1
    || active?.phase !== 'retreat'
  ) return null;

  const keys = targetKeysForSettledAction(active);
  const targets = keys.flatMap((key) => {
    const tile = findSceneTile(sceneState, key);
    const target = tile ? resolveTarget(tile, visualContext) : null;
    return target ? [target] : [];
  });
  return targets.length > 0
    ? { eventId: active.plan.action.eventId, targets }
    : null;
}

function targetKeysForSettledAction(active: ActiveTableAnimation3D): readonly string[] {
  const { action } = active.plan;
  if (action.type === 'tile_drawn') {
    return active.plan.hiddenHandKey ? [active.plan.hiddenHandKey] : [];
  }
  if (action.type === 'tile_discarded') {
    return active.plan.hiddenRiverKey ? [active.plan.hiddenRiverKey] : [];
  }
  if (action.type === 'meld_declared') {
    return active.plan.hiddenMeldTileKeys ?? [];
  }
  return [];
}

function resolveTarget(
  sceneTile: TableSceneTile,
  visualContext?: TileVisualSemanticContext,
): DoraSweep3DTarget | null {
  const semantics = resolveTileVisualSemantics({
    tileId: sceneTile.tile?.id,
    faceUp: sceneTile.faceState === 'face-up',
    doraKind: sceneTile.tile?.doraKind,
    context: visualContext,
  });
  if (!semantics.doraHighlight && !semantics.redDoraHighlight) return null;
  return {
    key: sceneTile.key,
    variant: semantics.combinedHighlight ? 'combined' : 'normal',
  };
}

function findSceneTile(sceneState: TableSceneState, key: string): TableSceneTile | undefined {
  for (const seat of Object.values(sceneState.seats)) {
    const handTile = seat.hand.find((tile) => tile.key === key);
    if (handTile) return handTile;
    const riverTile = seat.river.find((tile) => tile.key === key);
    if (riverTile) return riverTile;
    for (const meld of seat.melds) {
      const meldTile = meld.tiles.find((tile) => tile.key === key);
      if (meldTile) return meldTile;
    }
  }
  return sceneState.doraIndicators.find((tile) => tile.key === key)
    ?? sceneState.wall.find((tile) => tile.key === key)
    ?? sceneState.deadWall.find((tile) => tile.key === key);
}

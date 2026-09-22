import type {
  LocalHandPresentation,
  TableInteractionActions,
} from '../../presentation/table/TablePresentationContract';
import type { PlayerId } from '../../game/types';
import { STANDING_HAND_HIT_TARGET } from '../tile/tileGeometry';

export type Hand3DInteractionBinding = Readonly<{
  tileInstanceId: string;
  handIndex: number;
  playable: boolean;
  selected: boolean;
  drawn: boolean;
  riichiCandidate: boolean;
}>;

export function resolveHand3DInteractionBinding(
  playerId: PlayerId,
  sceneTileKey: string,
  handIndex: number,
  presentation?: LocalHandPresentation,
): Hand3DInteractionBinding | null {
  if (!presentation || presentation.playerId !== playerId) return null;
  const entry = presentation.tiles[handIndex];
  if (!entry || sceneTileKey !== `hand-${playerId}-${entry.tile.instanceId}`) return null;
  return {
    tileInstanceId: entry.tile.instanceId,
    handIndex,
    playable: entry.playable,
    selected: entry.selected,
    drawn: entry.drawn,
    riichiCandidate: entry.riichiCandidate,
  };
}

export function selectHand3DTile(
  binding: Hand3DInteractionBinding | null,
  actions?: TableInteractionActions,
): boolean {
  if (!binding?.playable || !actions) return false;
  actions.selectTile(binding.tileInstanceId);
  return true;
}

export function clearHand3DSelection(actions?: TableInteractionActions): void {
  actions?.selectTile(null);
}

export function activateHand3DTile(
  binding: Hand3DInteractionBinding | null,
  actions?: TableInteractionActions,
): boolean {
  if (!binding?.playable || !actions) return false;
  actions.selectTile(null);
  actions.discard(binding.tileInstanceId);
  return true;
}

export function resolveHand3DCursor(hoveredPlayableTileId: string | null): 'pointer' | 'default' {
  return hoveredPlayableTileId ? 'pointer' : 'default';
}

export function clearHoveredTileIfMatching(
  hoveredPlayableTileId: string | null,
  leavingTileId: string,
): string | null {
  return hoveredPlayableTileId === leavingTileId ? null : hoveredPlayableTileId;
}

export function shouldCommitDeferredHoverRelease(
  hoveredPlayableTileId: string | null,
  leavingTileId: string,
  scheduledRevision: number,
  currentRevision: number,
): boolean {
  return scheduledRevision === currentRevision
    && hoveredPlayableTileId === leavingTileId;
}

export function getStableHandHitInterval(
  centerX: number,
  tileScale = 1,
): Readonly<{ min: number; max: number }> {
  return {
    min: centerX - STANDING_HAND_HIT_TARGET.width * tileScale / 2,
    max: centerX + STANDING_HAND_HIT_TARGET.width * tileScale / 2,
  };
}

import type { Tile } from '../../game/types';
import type { SeventeenStepsState, SeventeenStepsPlayerId } from '../../game/seventeenSteps';
import type { AppearancePlayerSlot } from '../../presentation/appearance/playerSlotAppearance';
import type { PlayerProfile } from '../../profile/playerProfile';

export type VisibleTile = Readonly<Tile>;
export type PrivateRegion = Readonly<{ visibility: 'hidden'; count: number }> | Readonly<{ visibility: 'visible'; tiles: readonly VisibleTile[] }>;
export type TableParticipant = Readonly<{
  id: string;
  appearanceSlot: AppearancePlayerSlot;
  name: string;
  score: number;
  fixedHand: PrivateRegion;
  discardCandidates: PrivateRegion;
  discardedTiles: readonly VisibleTile[];
  remainingSteps?: number;
  /** Optional explicit profile for development presentation examples. */
  profile?: PlayerProfile;
}>;
export const SEVENTEEN_APPEARANCE_SLOTS = { 0: 0, 1: 1 } as const;
const visible = (tiles: readonly Tile[]): VisibleTile[] => tiles.map(tile => ({ ...tile }));

/** Rules owns legality/results. Hidden regions carry no tile identity, even after the round. */
export function presentSeventeenSteps(state: SeventeenStepsState, viewer: SeventeenStepsPlayerId = 0) {
  const participants: readonly TableParticipant[] = state.players.map(player => ({
    id: `seventeen:${player.id}`,
    appearanceSlot: SEVENTEEN_APPEARANCE_SLOTS[player.id],
    name: player.name,
    score: state.scores[player.id],
    fixedHand: player.id === viewer ? { visibility: 'visible', tiles: visible(player.fixedHand) } : { visibility: 'hidden', count: player.fixedHand.length },
    discardCandidates: player.id === viewer ? { visibility: 'visible', tiles: visible(player.discardCandidates) } : { visibility: 'hidden', count: player.discardCandidates.length },
    discardedTiles: visible(player.discardedTiles),
    remainingSteps: Math.max(0, 17 - player.discardCount),
  }));
  return {
    participants, viewerId: `seventeen:${viewer}`, phase: state.phase,
    currentParticipantId: `seventeen:${state.currentPlayerId}`,
    doraIndicators: visible(state.doraIndicators),
    // Result remains the authority's object, never recalculated by this adapter.
    result: state.result,
  };
}

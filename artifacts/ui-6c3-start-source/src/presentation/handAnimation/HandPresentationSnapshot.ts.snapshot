import type { PlayerId, Tile } from '../../game/types';
import type { TileDiscardedPresentationEvent } from '../PresentationEventBus';

/** Immutable presentation history, never a playable/rules state. */
export type HandDiscardHistory = Readonly<{
  preDiscardHand: readonly Tile[];
  drawnTile: Tile | null;
  discardedTile: Tile;
  finalHand: readonly Tile[];
  isTsumogiri: boolean;
}>;

export type HandPresentationPhase = 'idle' | 'lift' | 'carry' | 'river-settle'
  | 'gap-hold' | 'insert' | 'reorder' | 'complete';

export type HandPresentationSnapshot = HandDiscardHistory & Readonly<{
  eventId: string;
  playerId: PlayerId;
  discardVisualSlot: number;
  /** Slot occupants; concealed opponents may swap two visual identities. */
  visualHand: readonly Tile[];
}>;

export type HandPresentationFrame = Readonly<{
  snapshot: HandPresentationSnapshot;
  phase: HandPresentationPhase;
  progress: number;
}>;

export function deterministicDiscardSlot(eventId: string, playerId: PlayerId, count: number): number {
  let hash = 2166136261;
  for (const char of `${eventId}/${playerId}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % Math.max(1, count);
}

export function createHandPresentationSnapshot(
  event: TileDiscardedPresentationEvent,
  local: boolean,
): HandPresentationSnapshot | null {
  const history = event.handHistory;
  if (!history) return null; // Older events fail open; never reconstruct from a compact hand.
  const base = history.preDiscardHand.filter((tile) => tile.instanceId !== history.drawnTile?.instanceId);
  const ordered = [...base, ...(history.drawnTile ? [history.drawnTile] : [])];
  const exact = ordered.findIndex((tile) => tile.instanceId === history.discardedTile.instanceId);
  if (exact < 0 || history.discardedTile.id !== event.tile.id || history.discardedTile.red !== event.tile.red) return null;
  const discardVisualSlot = history.isTsumogiri ? base.length
    : local ? exact : deterministicDiscardSlot(event.eventId, event.playerId, base.length);
  if (discardVisualSlot >= ordered.length || (!history.isTsumogiri && discardVisualSlot >= base.length)) return null;
  const visualHand = [...ordered];
  [visualHand[exact], visualHand[discardVisualSlot]] = [visualHand[discardVisualSlot], visualHand[exact]];
  return Object.freeze({ ...history, eventId: event.eventId, playerId: event.playerId,
    discardVisualSlot, visualHand: Object.freeze(visualHand) });
}

export function handPresentationPhases(snapshot: HandPresentationSnapshot) {
  return [
    { phase: 'lift', durationMs: 150 },
    { phase: 'carry', durationMs: 240 },
    { phase: 'river-settle', durationMs: 110 },
    ...(snapshot.isTsumogiri ? [] : [
      { phase: 'gap-hold', durationMs: 130 },
      { phase: 'insert', durationMs: 220 },
      { phase: 'reorder', durationMs: 240 },
    ]),
    { phase: 'complete', durationMs: 0 },
  ] as readonly Readonly<{ phase: HandPresentationPhase; durationMs: number }>[];
}

export function riverOwnsDiscard(phase: HandPresentationPhase): boolean {
  return phase === 'gap-hold' || phase === 'insert' || phase === 'reorder' || phase === 'complete';
}

/** Normalized seat-local slot coordinates. Consumers supply their existing spacing/grounding. */
export function resolveHandPresentationSlots(frame: HandPresentationFrame) {
  const { snapshot, phase } = frame;
  const p = Math.max(0, Math.min(1, frame.progress));
  const t = p * p * (3 - 2 * p);
  const baseCount = snapshot.visualHand.length - (snapshot.drawnTile ? 1 : 0);
  return snapshot.visualHand.map((tile, index) => {
    const drawn = tile.instanceId === snapshot.drawnTile?.instanceId;
    const discarded = index === snapshot.discardVisualSlot;
    const finalIndex = snapshot.finalHand.findIndex((entry) => entry.instanceId === tile.instanceId);
    let slot = index;
    let drawnGap = drawn ? 1 : 0;
    let lift = 0;
    if (!snapshot.isTsumogiri && (phase === 'insert' || phase === 'reorder' || phase === 'complete')) {
      if (drawn) {
        const insert = phase === 'insert' ? t : 1;
        slot += (snapshot.discardVisualSlot - index) * insert;
        drawnGap = 1 - insert;
        lift = phase === 'insert' ? Math.sin(Math.PI * t) : 0;
      }
      if (phase === 'reorder' || phase === 'complete') {
        const reorder = phase === 'complete' ? 1 : t;
        // Include centering compensation when discarding after a call (no drawn tile).
        const finalSlot = finalIndex + (baseCount - snapshot.finalHand.length) / 2;
        slot += (finalSlot - slot) * reorder;
      }
    }
    return { tile, index, slot, drawnGap, lift, hidden: discarded, finalIndex };
  });
}

export function freezeHandDiscardHistory(history: HandDiscardHistory): HandDiscardHistory {
  const copyTile = (tile: Tile) => Object.freeze({ ...tile });
  return Object.freeze({ ...history,
    preDiscardHand: Object.freeze(history.preDiscardHand.map(copyTile)),
    drawnTile: history.drawnTile ? copyTile(history.drawnTile) : null,
    discardedTile: copyTile(history.discardedTile),
    finalHand: Object.freeze(history.finalHand.map(copyTile)),
  });
}

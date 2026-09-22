import { candidateRowSlots } from './candidateRows';
import type { Tile } from '../../game/types';
import { traceCandidate } from './candidateTrace';
import type { SeventeenStepsState } from '../../game/seventeenSteps';
import type { TileDiscardedPresentationEvent } from '../../presentation/PresentationEventBus';
import type { PresentationRect } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import { HAND_ANIMATION_PHASES, type HandAnimationAction, type HandAnimationPhase, type HandAnimationTarget } from '../../presentation/handAnimation/HandAnimationController';
import { animationFrameTask } from '../../presentation/animation/AnimationScheduler';
import type { AnimationCueFrame } from '../../presentation/PresentationAudioCue';
import { preloadHandPack, type HandPack } from '../../hand/handPacks';

export function candidateSlots<T>(tiles: readonly T[]) {
  const slots = candidateRowSlots(tiles.length, 'bottom');
  return tiles.map((tile, index) => ({ tile, ...slots[index] }));
}
export type CandidateCapture = Readonly<{ instanceId: string; row: number; column: number; rect: PresentationRect }>;
export type CandidateDiscard = Readonly<{
  session: string; playerId: 0 | 1; tile: Tile; riverIndex: number; river: readonly Tile[];
  candidates: readonly Tile[]; candidateCount?: number; source?: CandidateCapture; pack: HandPack;
}>;
export type CandidateFrame = Readonly<{ snapshot: CandidateDiscard; event?: TileDiscardedPresentationEvent; phase: HandAnimationPhase; progress: number }>;
export const candidateRiverOwns = (frame: CandidateFrame) => frame.phase === 'retreat';
export const candidateSourceHidden = (frame: CandidateFrame) => frame.phase !== 'approach' && !candidateRiverOwns(frame);

/** Confirmation is an exact authority transition, never a visual legality decision. */
export function confirmedCandidateDiscard(before: SeventeenStepsState, after: SeventeenStepsState, playerId: 0 | 1, instanceId: string) {
  const previous = before.players[playerId];
  const current = after.players[playerId];
  const tile = current.discardedTiles[previous.discardedTiles.length];
  return after !== before && current.discardedTiles.length === previous.discardedTiles.length + 1
    && tile?.instanceId === instanceId && previous.discardCandidates.some(t => t.instanceId === instanceId)
    && !current.discardCandidates.some(t => t.instanceId === instanceId) ? tile : null;
}

/** Mode target only. Scheduling, cancellation and playback are owned by the existing controller. */
export class CandidateAnimationTarget implements HandAnimationTarget {
  frame: CandidateFrame | null = null;
  private generation = 0;
  private preparedEvent: string | null = null;
  private cancelPrepare: (() => void) | null = null;
  private preparedResolve: (() => void) | null = null;
  constructor(private readonly publish: (frame: CandidateFrame | null) => void,
    private readonly release: (eventId: string) => void,
    private readonly preparePack: (pack: HandPack) => Promise<void> = preloadHandPack) {}
  capture(snapshot: CandidateDiscard) {
    if (this.frame) return false;
    this.frame = { snapshot, phase: 'approach', progress: 0 };
    traceCandidate('snapshot captured', { playerId: snapshot.playerId, source: snapshot.source });
    this.publish(this.frame);
    return true;
  }
  matches(action: HandAnimationAction) {
    const pending = this.frame?.snapshot;
    return action.type === 'tile_discarded' && pending?.playerId === action.playerId
      && pending.riverIndex === action.riverIndex && pending.tile.id === action.tile.id && pending.tile.red === action.tile.red;
  }
  beforeEnqueue(action: HandAnimationAction) {
    if (!this.matches(action) || this.frame?.event) return false;
    this.frame = { ...this.frame!, event: { ...action as TileDiscardedPresentationEvent, handHistory: undefined } };
    this.publish(this.frame);
    return true;
  }
  async prepare(action: HandAnimationAction) {
    traceCandidate('prepare start', { eventId: action.eventId });
    const frame = this.frame;
    const generation = this.generation;
    if (!frame || frame.event?.eventId !== action.eventId) return false;
    const committed = this.preparedEvent === action.eventId ? Promise.resolve() : new Promise<void>(resolve => { this.preparedResolve = resolve; });
    await Promise.race([Promise.all([this.preparePack(frame.snapshot.pack), committed]), new Promise<void>(resolve => { this.cancelPrepare = resolve; })]);
    this.cancelPrepare = null;
    traceCandidate('prepare end', { eventId: action.eventId, cancelled: generation !== this.generation });
    return generation === this.generation && this.frame?.event?.eventId === action.eventId;
  }
  prepared(eventId: string) {
    if (this.frame?.event?.eventId !== eventId) return;
    this.preparedEvent = eventId;
    this.preparedResolve?.(); this.preparedResolve = null;
  }
  animationTasks(action: HandAnimationAction, onFrame?: AnimationCueFrame) {
    return HAND_ANIMATION_PHASES.map(({ phase, durationMs }) => animationFrameTask(durationMs, progress => {
      if (this.frame?.event?.eventId !== action.eventId) return;
      if (progress === 0 || progress === 1) traceCandidate(`${phase} ${progress === 0 ? 'start' : 'end'}`, { eventId: action.eventId });
      if (phase === 'release' && progress === 0) traceCandidate('river settle', { eventId: action.eventId });
      if (phase === 'retreat' && progress === 0) traceCandidate('static river takeover', { eventId: action.eventId });
      this.frame = { ...this.frame, phase, progress };
      traceCandidate('scheduler frame', { eventId: action.eventId, phase, progress });
      this.publish(this.frame);
    }, progress => onFrame?.(phase, progress, 'candidate')));
  }
  setPhase() { /* animationTasks supplies the existing scheduler's finite frames. */ }
  finish(action: HandAnimationAction) { if (this.frame?.event?.eventId === action.eventId) this.clear(); }
  clear() {
    if (this.frame) traceCandidate('cleanup', { eventId: this.frame.event?.eventId });
    this.generation++;
    this.cancelPrepare?.(); this.cancelPrepare = null;
    this.preparedResolve?.(); this.preparedResolve = null; this.preparedEvent = null;
    const eventId = this.frame?.event?.eventId;
    this.frame = null;
    this.publish(null);
    if (eventId) this.release(eventId);
  }
}

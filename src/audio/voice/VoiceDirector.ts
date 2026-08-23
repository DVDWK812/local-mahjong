import type { ManagedVoicePlayback } from '../AudioManager';
import type { AudioSettings } from '../audioSettings';
import type { MatchResultPresentationEvent, MatchStartedPresentationEvent, RoundSettledPresentationEvent, WinScoredPresentationEvent } from '../../presentation/PresentationEventBus';
import { VOICE_PACK_REPOSITORY, type VoicePackRepository } from './VoicePackRepository';
import type { VoiceEvent } from './voiceEvents';
import { buildWinVoiceSequence, type WinPresentationItem, type WinVoiceSequence } from './winVoiceSequence';
import { buildDrawVoiceSequence, type DrawVoiceSequence } from './drawVoiceSequence';
import { buildMatchResultSequence, type MatchResultSequence } from './matchVoiceSequence';
import { HUMAN_PLAYER_ID } from '../../game/ai';
import { TILE_VOICE_KEYS } from './tileVoice';
import {
  DEFAULT_VOICE_SEAT_ASSIGNMENTS,
  resolveVoicePackForActor,
  type VoiceActorSeatContext,
  type VoiceSeatAssignments,
} from './voicePreferences';

export type VoicePlayResult = 'played' | 'disabled' | 'missing' | 'ignored' | 'failed';
export type WinSequencePlayResult = 'queued' | 'ignored';

export interface VoicePlaybackChannel {
  createVoicePlayback(id: string, src: string, volume: number): ManagedVoicePlayback | undefined;
}

/** `selectedVoicePackId` is accepted only for legacy settings compatibility; table playback ignores it. */
export type VoiceDirectorSettings = Pick<AudioSettings, 'voiceEnabled' | 'voiceVolume' | 'voicePackBySeat'>
  & Partial<Pick<AudioSettings, 'selectedVoicePackId' | 'discardVoiceEnabled' | 'discardVoiceScope'>>;

interface ActiveVoice { readonly event: VoiceEvent; readonly playback: ManagedVoicePlayback; }
type WinSequenceItemStatus = 'played' | 'disabled' | 'missing' | 'failed' | 'stopped';
export type WinSequenceSignal =
  | { readonly type: 'sequenceStarted'; readonly sequence: WinVoiceSequence; readonly packId: string | null }
  | { readonly type: 'itemStarted'; readonly sequence: WinVoiceSequence; readonly item: WinPresentationItem; readonly index: number; readonly packId: string | null }
  | { readonly type: 'itemCompleted'; readonly sequence: WinVoiceSequence; readonly item: WinPresentationItem; readonly index: number; readonly packId: string | null; readonly status: WinSequenceItemStatus }
  | { readonly type: 'sequenceCompleted'; readonly sequence: WinVoiceSequence; readonly packId: string | null; readonly status: 'completed' | 'stopped' };
type NarrationSequence = WinVoiceSequence | DrawVoiceSequence | MatchResultSequence | {
  readonly id: string;
  readonly items: readonly [{ readonly voiceKey: 'game.start' }];
};
type NarrationSequenceItem = NarrationSequence['items'][number];
interface QueuedNarrationSequence {
  readonly kind: 'win' | 'draw' | 'match-start' | 'match-result';
  readonly sequence: NarrationSequence;
  /** Winners retain their snapshot Pack; all other sequences resolve every actor separately. */
  readonly packId?: string | null;
}
interface ActiveSequenceItem { readonly playback: ManagedVoicePlayback; readonly complete: (status: WinSequenceItemStatus) => void; }

/** One automatic voice channel. Equal priority replaces the active voice; higher priority interrupts lower. */
export class VoiceDirector {
  private enabled: boolean;
  private volume: number;
  private assignments: VoiceSeatAssignments;
  private discardVoiceEnabled: boolean;
  private discardVoiceScope: 'all' | 'self';
  private actorSeatContext: VoiceActorSeatContext = { playerIds: [], playerCount: 0 };
  private active: ActiveVoice | null = null;
  private readonly consumedEventIds = new Set<string>();
  private readonly winSequenceListeners = new Set<(signal: WinSequenceSignal) => void>();
  private readonly narrationQueue: QueuedNarrationSequence[] = [];
  private narrationSequenceRun: Promise<void> | null = null;
  private activeSequenceItem: ActiveSequenceItem | null = null;
  private sequenceGeneration = 0;
  private activeWinSequenceId: string | null = null;
  private skippedWinSequenceId: string | null = null;

  constructor(
    private readonly repository: Pick<VoicePackRepository, 'getAudioForKey' | 'listPacks'> = VOICE_PACK_REPOSITORY,
    private readonly channel: VoicePlaybackChannel,
    settings: VoiceDirectorSettings,
  ) {
    this.enabled = settings.voiceEnabled;
    this.volume = settings.voiceVolume;
    this.assignments = settings.voicePackBySeat ?? DEFAULT_VOICE_SEAT_ASSIGNMENTS;
    this.discardVoiceEnabled = settings.discardVoiceEnabled ?? false;
    this.discardVoiceScope = settings.discardVoiceScope ?? 'all';
  }

  play(event: VoiceEvent): VoicePlayResult {
    if (this.consumedEventIds.has(event.eventId)) return 'ignored';
    this.remember(event.eventId);
    if (this.narrationSequenceRun || this.narrationQueue.length > 0) return 'ignored';
    if (!this.enabled) return 'disabled';
    if (isTileVoiceKey(event.key) && (!this.discardVoiceEnabled || (this.discardVoiceScope === 'self' && event.actorId !== String(HUMAN_PLAYER_ID)))) return 'disabled';
    if (this.active && event.priority < this.active.event.priority) return 'ignored';
    const packId = resolveVoicePackForActor(
      event.actorId,
      this.actorSeatContext,
      this.assignments,
      this.repository.listPacks(),
    );
    const url = packId ? this.repository.getAudioForKey(packId, event.key) : undefined;
    if (!url) return 'missing';
    this.stop();
    const playback = this.channel.createVoicePlayback(`voice:${event.key}:${event.eventId}`, url, this.volume);
    if (!playback) return 'failed';
    this.active = { event, playback };
    playback.handle.onEnded(() => {
      if (this.active?.playback === playback) this.active = null;
    });
    void playback.handle.play().catch(() => {
      if (this.active?.playback === playback) this.stop();
    });
    return 'played';
  }

  /** Queues a complete winning-hand presentation. The selected Pack is snapshotted per winner. */
  playWinSequence(event: WinScoredPresentationEvent): WinSequencePlayResult {
    if (this.consumedEventIds.has(event.eventId)) return 'ignored';
    this.remember(event.eventId);
    const sequence = buildWinVoiceSequence(event);
    const packId = resolveVoicePackForActor(
      String(event.winnerId), this.actorSeatContext, this.assignments, this.repository.listPacks(),
    );
    this.enqueueNarration({ kind: 'win', sequence, packId });
    return 'queued';
  }

  /** Queues the authoritative exhaustive-draw announcement and seat-ordered statuses. */
  playExhaustiveDrawSequence(event: Extract<RoundSettledPresentationEvent, { settlementType: 'exhaustive-draw' }>): WinSequencePlayResult {
    if (this.consumedEventIds.has(event.eventId)) return 'ignored';
    this.remember(event.eventId);
    this.enqueueNarration({ kind: 'draw', sequence: buildDrawVoiceSequence(event) });
    return 'queued';
  }

  /** A match lifecycle fact, not a React-render side effect. */
  playMatchStarted(event: MatchStartedPresentationEvent): WinSequencePlayResult {
    if (this.consumedEventIds.has(event.eventId)) return 'ignored';
    this.remember(event.eventId);
    this.enqueueNarration({ kind: 'match-start', sequence: { id: event.eventId, items: [{ voiceKey: 'game.start' }] } });
    return 'queued';
  }

  /** Queues final-place announcements from the immutable MatchState.finalResult snapshot. */
  playMatchResultSequence(event: MatchResultPresentationEvent): WinSequencePlayResult {
    if (this.consumedEventIds.has(event.eventId)) return 'ignored';
    this.remember(event.eventId);
    this.enqueueNarration({ kind: 'match-result', sequence: buildMatchResultSequence(event) });
    return 'queued';
  }

  subscribeWinSequence(listener: (signal: WinSequenceSignal) => void): () => void {
    this.winSequenceListeners.add(listener);
    return () => this.winSequenceListeners.delete(listener);
  }

  stop(): void {
    this.sequenceGeneration += 1;
    this.narrationQueue.splice(0);
    this.stopActiveSequenceItem('stopped');
    this.stopRealtimeVoice();
  }

  /** Stops only the current winning-hand narration; queued later winners may still play. */
  skipCurrentWinSequence(): boolean {
    if (!this.activeWinSequenceId) return false;
    this.skippedWinSequenceId = this.activeWinSequenceId;
    this.stopActiveSequenceItem('stopped');
    return true;
  }

  private stopRealtimeVoice(): void {
    const active = this.active;
    this.active = null;
    active?.playback.stop();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopRealtimeVoice();
      this.stopActiveSequenceItem('disabled');
    }
  }
  setVolume(volume: number): void { this.volume = clampVolume(volume); this.active?.playback.handle.setVolume(this.volume); }
  setActorSeatContext(context: VoiceActorSeatContext): void { this.actorSeatContext = context; }
  setSettings(settings: VoiceDirectorSettings): void {
    this.setEnabled(settings.voiceEnabled);
    this.setVolume(settings.voiceVolume);
    this.assignments = settings.voicePackBySeat ?? DEFAULT_VOICE_SEAT_ASSIGNMENTS;
    this.discardVoiceEnabled = settings.discardVoiceEnabled ?? false;
    this.discardVoiceScope = settings.discardVoiceScope ?? 'all';
  }

  private remember(eventId: string): void {
    this.consumedEventIds.add(eventId);
    if (this.consumedEventIds.size > 256) this.consumedEventIds.delete(this.consumedEventIds.values().next().value as string);
  }

  private enqueueNarration(queued: QueuedNarrationSequence): void {
    this.narrationQueue.push(queued);
    if (!this.narrationSequenceRun) {
      this.stopRealtimeVoice();
      this.narrationSequenceRun = this.runNarrationSequenceQueue(this.sequenceGeneration);
    }
  }

  private async runNarrationSequenceQueue(generation: number): Promise<void> {
    try {
      while (generation === this.sequenceGeneration) {
        const queued = this.narrationQueue.shift();
        if (!queued) return;
        const isWin = queued.kind === 'win';
        if (isWin) {
          this.activeWinSequenceId = queued.sequence.id;
          this.emit({ type: 'sequenceStarted', sequence: queued.sequence as WinVoiceSequence, packId: queued.packId ?? null });
        }
        let status: 'completed' | 'stopped' = 'completed';
        for (const [index, item] of queued.sequence.items.entries()) {
          if (generation !== this.sequenceGeneration || (isWin && this.skippedWinSequenceId === queued.sequence.id)) { status = 'stopped'; break; }
          await this.playNarrationSequenceItem(queued, item, index);
          if (isWin && this.skippedWinSequenceId === queued.sequence.id) { status = 'stopped'; break; }
        }
        if (isWin) {
          this.emit({ type: 'sequenceCompleted', sequence: queued.sequence as WinVoiceSequence, packId: queued.packId ?? null, status });
          if (this.activeWinSequenceId === queued.sequence.id) this.activeWinSequenceId = null;
          if (this.skippedWinSequenceId === queued.sequence.id) this.skippedWinSequenceId = null;
        }
        if (status === 'stopped' && generation !== this.sequenceGeneration) return;
      }
    } finally {
      this.narrationSequenceRun = null;
      if (this.narrationQueue.length > 0 && !this.narrationSequenceRun) this.narrationSequenceRun = this.runNarrationSequenceQueue(this.sequenceGeneration);
    }
  }

  private async playNarrationSequenceItem(queued: QueuedNarrationSequence, item: NarrationSequenceItem, index: number): Promise<void> {
    const isWin = queued.kind === 'win';
    const winItem = item as WinPresentationItem;
    if (isWin) this.emit({ type: 'itemStarted', sequence: queued.sequence as WinVoiceSequence, item: winItem, index, packId: queued.packId ?? null });
    const complete = (status: WinSequenceItemStatus) => {
      if (isWin) this.emit({ type: 'itemCompleted', sequence: queued.sequence as WinVoiceSequence, item: winItem, index, packId: queued.packId ?? null, status });
    };
    if (!this.enabled) { complete('disabled'); return; }
    const actorId = 'actorId' in item && item.actorId !== undefined ? String(item.actorId) : undefined;
    const packId = isWin
      ? queued.packId ?? null
      : resolveVoicePackForActor(actorId, this.actorSeatContext, this.assignments, this.repository.listPacks());
    const url = packId ? this.repository.getAudioForKey(packId, item.voiceKey) : undefined;
    if (!url) { complete('missing'); return; }
    const playback = this.channel.createVoicePlayback(`${queued.kind}-sequence:${queued.sequence.id}:${index}:${item.voiceKey}`, url, this.volume);
    if (!playback) { complete('failed'); return; }
    const status = await new Promise<WinSequenceItemStatus>((resolve) => {
      let settled = false;
      let removeEnded: (() => void) | undefined;
      const finish = (next: WinSequenceItemStatus) => {
        if (settled) return;
        settled = true;
        removeEnded?.();
        if (this.activeSequenceItem?.playback === playback) this.activeSequenceItem = null;
        resolve(next);
      };
      removeEnded = playback.handle.onEnded(() => finish('played'));
      this.activeSequenceItem = { playback, complete: finish };
      void playback.handle.play().catch(() => finish('failed'));
    });
    if (status !== 'played') playback.stop();
    complete(status);
  }

  private stopActiveSequenceItem(status: WinSequenceItemStatus): void {
    const active = this.activeSequenceItem;
    if (!active) return;
    active.playback.stop();
    active.complete(status);
  }

  private emit(signal: WinSequenceSignal): void {
    [...this.winSequenceListeners].forEach((listener) => {
      try { listener(signal); } catch { /* Presentation listeners must not affect game or audio flow. */ }
    });
  }
}

function clampVolume(value: number): number { return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.8; }
function isTileVoiceKey(key: string): boolean { return (TILE_VOICE_KEYS as readonly string[]).includes(key); }

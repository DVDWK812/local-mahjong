import type { ManagedVoicePlayback } from '../AudioManager';
import type { AudioSettings } from '../audioSettings';
import type { WinScoredPresentationEvent } from '../../presentation/PresentationEventBus';
import { VOICE_PACK_REPOSITORY, type VoicePackRepository } from './VoicePackRepository';
import type { VoiceEvent } from './voiceEvents';
import { buildWinVoiceSequence, type WinPresentationItem, type WinVoiceSequence } from './winVoiceSequence';
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

export type VoiceDirectorSettings = Pick<AudioSettings, 'voiceEnabled' | 'voiceVolume' | 'selectedVoicePackId' | 'voicePackBySeat'>;

interface ActiveVoice { readonly event: VoiceEvent; readonly playback: ManagedVoicePlayback; }
type WinSequenceItemStatus = 'played' | 'disabled' | 'missing' | 'failed' | 'stopped';
export type WinSequenceSignal =
  | { readonly type: 'sequenceStarted'; readonly sequence: WinVoiceSequence; readonly packId: string | null }
  | { readonly type: 'itemStarted'; readonly sequence: WinVoiceSequence; readonly item: WinPresentationItem; readonly index: number; readonly packId: string | null }
  | { readonly type: 'itemCompleted'; readonly sequence: WinVoiceSequence; readonly item: WinPresentationItem; readonly index: number; readonly packId: string | null; readonly status: WinSequenceItemStatus }
  | { readonly type: 'sequenceCompleted'; readonly sequence: WinVoiceSequence; readonly packId: string | null; readonly status: 'completed' | 'stopped' };
interface QueuedWinSequence { readonly sequence: WinVoiceSequence; readonly packId: string | null; }
interface ActiveSequenceItem { readonly playback: ManagedVoicePlayback; readonly complete: (status: WinSequenceItemStatus) => void; }

/** One automatic voice channel. Equal priority replaces the active voice; higher priority interrupts lower. */
export class VoiceDirector {
  private enabled: boolean;
  private volume: number;
  private selectedPackId: string | null;
  private assignments: VoiceSeatAssignments;
  private actorSeatContext: VoiceActorSeatContext = { playerIds: [], playerCount: 0 };
  private active: ActiveVoice | null = null;
  private readonly consumedEventIds = new Set<string>();
  private readonly winSequenceListeners = new Set<(signal: WinSequenceSignal) => void>();
  private readonly winQueue: QueuedWinSequence[] = [];
  private winSequenceRun: Promise<void> | null = null;
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
    this.selectedPackId = settings.selectedVoicePackId;
    this.assignments = settings.voicePackBySeat ?? DEFAULT_VOICE_SEAT_ASSIGNMENTS;
  }

  play(event: VoiceEvent): VoicePlayResult {
    if (this.consumedEventIds.has(event.eventId)) return 'ignored';
    this.remember(event.eventId);
    if (this.winSequenceRun || this.winQueue.length > 0) return 'ignored';
    if (!this.enabled) return 'disabled';
    if (this.active && event.priority < this.active.event.priority) return 'ignored';
    const packId = resolveVoicePackForActor(
      event.actorId,
      this.actorSeatContext,
      this.assignments,
      this.selectedPackId,
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
      String(event.winnerId), this.actorSeatContext, this.assignments, this.selectedPackId, this.repository.listPacks(),
    );
    this.winQueue.push({ sequence, packId });
    if (!this.winSequenceRun) {
      this.stopRealtimeVoice();
      this.winSequenceRun = this.runWinSequenceQueue(this.sequenceGeneration);
    }
    return 'queued';
  }

  subscribeWinSequence(listener: (signal: WinSequenceSignal) => void): () => void {
    this.winSequenceListeners.add(listener);
    return () => this.winSequenceListeners.delete(listener);
  }

  stop(): void {
    this.sequenceGeneration += 1;
    this.winQueue.splice(0);
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
  setPack(packId: string | null): void { this.selectedPackId = packId; }
  setActorSeatContext(context: VoiceActorSeatContext): void { this.actorSeatContext = context; }
  setSettings(settings: VoiceDirectorSettings): void {
    this.setEnabled(settings.voiceEnabled);
    this.setVolume(settings.voiceVolume);
    this.setPack(settings.selectedVoicePackId);
    this.assignments = settings.voicePackBySeat ?? DEFAULT_VOICE_SEAT_ASSIGNMENTS;
  }

  private remember(eventId: string): void {
    this.consumedEventIds.add(eventId);
    if (this.consumedEventIds.size > 256) this.consumedEventIds.delete(this.consumedEventIds.values().next().value as string);
  }

  private async runWinSequenceQueue(generation: number): Promise<void> {
    try {
      while (generation === this.sequenceGeneration) {
        const queued = this.winQueue.shift();
        if (!queued) return;
        this.activeWinSequenceId = queued.sequence.id;
        this.emit({ type: 'sequenceStarted', sequence: queued.sequence, packId: queued.packId });
        let status: 'completed' | 'stopped' = 'completed';
        for (const [index, item] of queued.sequence.items.entries()) {
          if (generation !== this.sequenceGeneration || this.skippedWinSequenceId === queued.sequence.id) { status = 'stopped'; break; }
          await this.playWinSequenceItem(queued, item, index);
          if (this.skippedWinSequenceId === queued.sequence.id) { status = 'stopped'; break; }
        }
        this.emit({ type: 'sequenceCompleted', sequence: queued.sequence, packId: queued.packId, status });
        if (this.activeWinSequenceId === queued.sequence.id) this.activeWinSequenceId = null;
        if (this.skippedWinSequenceId === queued.sequence.id) this.skippedWinSequenceId = null;
        if (status === 'stopped' && generation !== this.sequenceGeneration) return;
      }
    } finally {
      this.winSequenceRun = null;
      if (this.winQueue.length > 0 && !this.winSequenceRun) this.winSequenceRun = this.runWinSequenceQueue(this.sequenceGeneration);
    }
  }

  private async playWinSequenceItem(queued: QueuedWinSequence, item: WinPresentationItem, index: number): Promise<void> {
    this.emit({ type: 'itemStarted', sequence: queued.sequence, item, index, packId: queued.packId });
    const complete = (status: WinSequenceItemStatus) => {
      this.emit({ type: 'itemCompleted', sequence: queued.sequence, item, index, packId: queued.packId, status });
    };
    if (!this.enabled) { complete('disabled'); return; }
    const url = queued.packId ? this.repository.getAudioForKey(queued.packId, item.voiceKey) : undefined;
    if (!url) { complete('missing'); return; }
    const playback = this.channel.createVoicePlayback(`win-sequence:${queued.sequence.id}:${index}:${item.voiceKey}`, url, this.volume);
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

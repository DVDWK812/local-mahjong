import type { WinSequenceSignal } from './VoiceDirector';
import type { WinPresentationItem, WinVoiceSequence } from './winVoiceSequence';

/** UI-only delay used when narration is disabled or an item has no audio asset. */
export const SILENT_WIN_PRESENTATION_DURATION_MS = 320;

export interface PresentedWinSequence {
  readonly sequenceId: string;
  readonly winnerId: string | number;
  readonly visibleItems: readonly WinPresentationItem[];
  readonly sequenceCompleted: boolean;
}

export interface WinResultPresentationState {
  readonly sequences: readonly PresentedWinSequence[];
  readonly activeSequenceId: string | null;
}

export interface WinSequenceSignalSource {
  subscribeWinSequence(listener: (signal: WinSequenceSignal) => void): () => void;
  skipCurrentWinSequence?(): boolean;
}

/** Optional, safe diagnostic for an unexpected lifecycle ordering. */
export interface WinPresentationDiagnostic {
  readonly code: 'missing-sequence-started';
  readonly signalType: Exclude<WinSequenceSignal['type'], 'sequenceStarted'>;
  readonly sequenceId: string;
  readonly winnerId: string | number;
}

interface SequenceTracker {
  readonly sequence: WinVoiceSequence;
  readonly started: Map<number, WinPresentationItem>;
  readonly completed: Map<number, WinSequenceItemCompletionStatus>;
  visibleItems: WinPresentationItem[];
  nextIndex: number;
  visibleIndex: number | null;
  sourceCompleted: boolean;
  sequenceCompleted: boolean;
  forcedComplete: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

type WinSequenceItemCompletionStatus = 'played' | 'disabled' | 'missing' | 'failed' | 'stopped';

const EMPTY_STATE: WinResultPresentationState = Object.freeze({ sequences: [], activeSequenceId: null });

/**
 * Bridges the voice sequence lifecycle into a UI-safe stream. It never changes a
 * game result: it only decides when already-created sequence items become visible.
 */
export class WinResultPresentationController {
  private readonly listeners = new Set<() => void>();
  private readonly trackers = new Map<string, SequenceTracker>();
  private state: WinResultPresentationState = EMPTY_STATE;
  private unsubscribe: (() => void) | null = null;
  private readonly skipCurrentSequenceAudio: (() => boolean) | undefined;

  constructor(
    source: WinSequenceSignalSource,
    private readonly silentDurationMs = SILENT_WIN_PRESENTATION_DURATION_MS,
    private readonly onDiagnostic?: (diagnostic: WinPresentationDiagnostic) => void,
    autoStart = true,
  ) {
    this.source = source;
    this.skipCurrentSequenceAudio = source.skipCurrentWinSequence?.bind(source);
    if (autoStart) this.start();
  }

  private readonly source: WinSequenceSignalSource;

  get activeSubscriptionCount(): number { return this.unsubscribe ? 1 : 0; }

  /** Idempotent so an App-level StrictMode effect can safely restart it. */
  start(): boolean {
    if (this.unsubscribe) return false;
    this.unsubscribe = this.source.subscribeWinSequence(this.handleSignal);
    return true;
  }

  stop(): boolean {
    if (!this.unsubscribe) return false;
    this.unsubscribe();
    this.unsubscribe = null;
    return true;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot = (): WinResultPresentationState => this.state;

  reset(): void {
    this.trackers.forEach((tracker) => this.clearTimer(tracker));
    this.trackers.clear();
    this.publish();
  }

  dispose(): void {
    this.reset();
    this.stop();
    this.listeners.clear();
  }

  /** Future skip controls can call this without knowing any yaku-specific state. */
  completeCurrentSequencePresentation(): boolean {
    const tracker = [...this.trackers.values()].find((candidate) => !candidate.sequenceCompleted);
    if (!tracker) return false;
    this.clearTimer(tracker);
    tracker.visibleItems = [...tracker.sequence.items];
    tracker.nextIndex = tracker.sequence.items.length;
    tracker.visibleIndex = null;
    tracker.sourceCompleted = true;
    tracker.sequenceCompleted = true;
    tracker.forcedComplete = true;
    this.skipCurrentSequenceAudio?.();
    this.publish();
    return true;
  }

  private readonly handleSignal = (signal: WinSequenceSignal): void => {
    if (signal.type === 'sequenceStarted') {
      this.trackers.set(signal.sequence.id, this.createTracker(signal.sequence));
      this.publish();
      return;
    }
    const tracker = this.trackerFor(signal);
    if (tracker.forcedComplete) return;
    if (signal.type === 'itemStarted') {
      tracker.started.set(signal.index, signal.item);
      this.drain(tracker);
      return;
    }
    if (signal.type === 'itemCompleted') {
      tracker.completed.set(signal.index, signal.status);
      if (tracker.visibleIndex !== signal.index) return;
      if (signal.status === 'played') this.advance(tracker);
      else this.scheduleSilentAdvance(tracker);
      return;
    }
    tracker.sourceCompleted = true;
    this.finishIfReady(tracker);
  };

  private createTracker(sequence: WinVoiceSequence): SequenceTracker {
    return {
      sequence,
      started: new Map(),
      completed: new Map(),
      visibleItems: [],
      nextIndex: 0,
      visibleIndex: null,
      sourceCompleted: false,
      sequenceCompleted: false,
      forcedComplete: false,
      timer: null,
    };
  }

  /**
   * A controller is created before game events in App, but each lifecycle
   * signal carries its complete sequence so an unexpected ordering can remain
   * visible instead of being silently dropped.
   */
  private trackerFor(signal: Exclude<WinSequenceSignal, { type: 'sequenceStarted' }>): SequenceTracker {
    const existing = this.trackers.get(signal.sequence.id);
    if (existing) return existing;
    const tracker = this.createTracker(signal.sequence);
    this.trackers.set(signal.sequence.id, tracker);
    this.onDiagnostic?.({
      code: 'missing-sequence-started',
      signalType: signal.type,
      sequenceId: signal.sequence.id,
      winnerId: signal.sequence.winnerId,
    });
    return tracker;
  }

  private drain(tracker: SequenceTracker): void {
    if (tracker.visibleIndex !== null || tracker.sequenceCompleted) return;
    const item = tracker.started.get(tracker.nextIndex);
    if (!item) return;
    tracker.visibleItems = [...tracker.visibleItems, item];
    tracker.visibleIndex = tracker.nextIndex;
    this.publish();
    if (tracker.completed.has(tracker.nextIndex)) {
      const status = tracker.completed.get(tracker.nextIndex);
      if (status === 'played') this.advance(tracker);
      else this.scheduleSilentAdvance(tracker);
    }
  }

  private scheduleSilentAdvance(tracker: SequenceTracker): void {
    if (tracker.timer || tracker.sequenceCompleted) return;
    tracker.timer = setTimeout(() => {
      tracker.timer = null;
      this.advance(tracker);
    }, this.silentDurationMs);
  }

  private advance(tracker: SequenceTracker): void {
    this.clearTimer(tracker);
    if (tracker.visibleIndex === null) return;
    tracker.nextIndex = tracker.visibleIndex + 1;
    tracker.visibleIndex = null;
    this.drain(tracker);
    this.finishIfReady(tracker);
  }

  private finishIfReady(tracker: SequenceTracker): void {
    if (!tracker.sourceCompleted || tracker.visibleIndex !== null || tracker.nextIndex < tracker.sequence.items.length) return;
    tracker.sequenceCompleted = true;
    this.publish();
  }

  private clearTimer(tracker: SequenceTracker): void {
    if (tracker.timer !== null) clearTimeout(tracker.timer);
    tracker.timer = null;
  }

  private publish(): void {
    const sequences = Object.freeze([...this.trackers.values()].map((tracker) => Object.freeze({
      sequenceId: tracker.sequence.id,
      winnerId: tracker.sequence.winnerId,
      visibleItems: Object.freeze([...tracker.visibleItems]),
      sequenceCompleted: tracker.sequenceCompleted,
    })));
    const active = sequences.find((sequence) => !sequence.sequenceCompleted);
    this.state = sequences.length === 0 ? EMPTY_STATE : Object.freeze({ sequences, activeSequenceId: active?.sequenceId ?? null });
    this.listeners.forEach((listener) => listener());
  }
}

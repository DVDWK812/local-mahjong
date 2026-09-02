import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AnimationScheduler } from '../../presentation/animation/AnimationScheduler';
import { HandAnimationConsumer } from '../../presentation/handAnimation/HandAnimationConsumer';
import {
  HandAnimationController,
  type HandAnimationAction,
  type HandAnimationPhase,
  type HandAnimationTarget,
} from '../../presentation/handAnimation/HandAnimationController';
import { presentationPacingGate } from '../../presentation/pacing/PresentationPacingGate';
import type { DiscardSourceSnapshotStore } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import type { PresentationEvent } from '../../presentation/PresentationEventBus';
import type { TableSceneState } from '../sceneState/tableSceneTypes';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import type { ActiveTableAnimation3D } from './HandAction3D';
import type { DiscardSource3DStore } from './DiscardSource3D';
import { PaintCommitBarrier } from './PaintCommitBarrier';
import {
  resolveTableAnimation3DPlan,
  getTableAnimation3DHoldMs,
  type TableAnimation3DAction,
  type TableAnimation3DPlan,
  type LocalHandAnimation3DState,
} from './tableAnimation3D';

export type TableAnimation3DRenderState = Readonly<{
  active: ActiveTableAnimation3D | null;
  hiddenHandKeys: ReadonlySet<string>;
  hiddenRiverKeys: ReadonlySet<string>;
  hiddenMeldTileKeys: ReadonlySet<string>;
  hiddenRiichiSeats: ReadonlySet<Table3DSeat>;
}>;

const EMPTY_STATE: TableAnimation3DRenderState = {
  active: null,
  hiddenHandKeys: new Set(),
  hiddenRiverKeys: new Set(),
  hiddenMeldTileKeys: new Set(),
  hiddenRiichiSeats: new Set(),
};

export function useTableAnimation3D({
  sceneState,
  sourceStore,
  enabled,
  sessionKey,
  animationTurn,
  localDiscardSnapshots,
  onLocalHandAnimationChange,
}: Readonly<{
  sceneState: TableSceneState;
  sourceStore: DiscardSource3DStore;
  enabled: boolean;
  sessionKey: string;
  animationTurn: number;
  localDiscardSnapshots?: DiscardSourceSnapshotStore;
  onLocalHandAnimationChange?: (state: LocalHandAnimation3DState | null) => void;
}>): TableAnimation3DRenderState {
  const sceneStateRef = useRef(sceneState);
  const enabledRef = useRef(enabled);
  const sessionKeyRef = useRef(sessionKey);
  const animationTurnRef = useRef(animationTurn);
  const localDiscardSnapshotsRef = useRef(localDiscardSnapshots);
  const onLocalHandAnimationChangeRef = useRef(onLocalHandAnimationChange);
  const controllerRef = useRef<HandAnimationController | null>(null);
  const [renderState, setRenderState] = useState<TableAnimation3DRenderState>(EMPTY_STATE);
  sceneStateRef.current = sceneState;
  enabledRef.current = enabled;
  sessionKeyRef.current = sessionKey;
  animationTurnRef.current = animationTurn;
  localDiscardSnapshotsRef.current = localDiscardSnapshots;
  onLocalHandAnimationChangeRef.current = onLocalHandAnimationChange;

  useEffect(() => {
    const target = new TableAnimation3DTarget(
      () => sceneStateRef.current,
      sourceStore,
      () => sessionKeyRef.current,
      setRenderState,
      () => animationTurnRef.current,
      () => localDiscardSnapshotsRef.current,
      (state) => onLocalHandAnimationChangeRef.current?.(state),
    );
    const scheduler = new AnimationScheduler();
    const controller = new HandAnimationController(target, scheduler, {
      maxQueuedActions: 6,
      onError: () => target.clear(),
      onSettled: (action) => presentationPacingGate.complete(action.eventId),
      postAnimationHoldMs: (action) => isTableAnimation3DAction(action)
        ? getTableAnimation3DHoldMs(action)
        : 0,
    });
    const consumer = new HandAnimationConsumer(
      controller,
      undefined,
      () => enabledRef.current,
      undefined,
      map3DAnimationEvent,
      presentationPacingGate,
    );
    controllerRef.current = controller;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotionPreference = () => controller.setSkip(reducedMotion.matches);
    applyMotionPreference();
    reducedMotion.addEventListener('change', applyMotionPreference);

    return () => {
      reducedMotion.removeEventListener('change', applyMotionPreference);
      consumer.dispose();
      controller.dispose();
      target.clear();
      sourceStore.clear();
      controllerRef.current = null;
    };
  }, [sourceStore]);

  useEffect(() => {
    sourceStore.clear();
    controllerRef.current?.cancelAll();
  }, [enabled, sessionKey, sourceStore]);

  return renderState;
}

export class TableAnimation3DTarget implements HandAnimationTarget {
  private readonly plans = new Map<string, TableAnimation3DPlan>();
  private readonly seenEventIds = new Set<string>();
  private readonly suppressedFinishes = new Map<string, number>();

  constructor(
    private readonly getSceneState: () => TableSceneState,
    private readonly sourceStore: DiscardSource3DStore,
    private readonly getSessionKey: () => string,
    private readonly setRenderState: Dispatch<SetStateAction<TableAnimation3DRenderState>>,
    private readonly getAnimationTurn: () => number = () => 0,
    private readonly getLocalDiscardSnapshots: () => DiscardSourceSnapshotStore | undefined = () => undefined,
    private readonly onLocalHandAnimationChange: (state: LocalHandAnimation3DState | null) => void = () => undefined,
    private readonly paintCommitBarrier: PaintCommitBarrier = new PaintCommitBarrier(),
  ) {}

  beforeEnqueue(action: HandAnimationAction): boolean {
    if (!isTableAnimation3DAction(action)) return false;
    if (this.seenEventIds.has(action.eventId)) {
      this.suppressedFinishes.set(
        action.eventId,
        (this.suppressedFinishes.get(action.eventId) ?? 0) + 1,
      );
      return false;
    }
    this.seenEventIds.add(action.eventId);
    trimSeenEvents(this.seenEventIds);
    const resolvedPlan = resolveTableAnimation3DPlan(
      action,
      this.getSceneState(),
      this.sourceStore,
      this.getSessionKey(),
    );
    if (!resolvedPlan) return false;
    const localDiscardSnapshot = action.type === 'tile_discarded' && resolvedPlan.seat === 'bottom'
      ? this.getLocalDiscardSnapshots()?.consume(action, {
        sessionKey: this.getSessionKey(),
        confirmedTurn: this.getAnimationTurn(),
      })
      : null;
    const plan = localDiscardSnapshot
      ? { ...resolvedPlan, localDiscardSnapshotReady: true }
      : resolvedPlan;
    this.plans.set(action.eventId, plan);
    return true;
  }

  prepare(action: HandAnimationAction): boolean | Promise<boolean> {
    const plan = this.plans.get(action.eventId);
    if (!plan) return false;
    this.setRenderState((current) => prepareTableAnimation3DRenderState(current, plan));
    if (plan.localDomDraw) {
      this.onLocalHandAnimationChange({ eventId: action.eventId, kind: 'draw', phase: 'enter' });
      return nextPaint().then(() => true);
    } else if (plan.localDiscardSnapshotReady) {
      void this.paintCommitBarrier.wait().then(() => {
        if (this.plans.get(action.eventId) !== plan) return;
        this.onLocalHandAnimationChange({ eventId: action.eventId, kind: 'discard', phase: 'proxy-ready' });
      });
    }
    return true;
  }

  setPhase(action: HandAnimationAction, phase: HandAnimationPhase): void {
    const plan = this.plans.get(action.eventId);
    if (!plan) return;
    this.setRenderState((current) => transitionTableAnimation3DRenderState(current, plan, phase));
    if (plan.localDomDraw) {
      this.onLocalHandAnimationChange({ eventId: action.eventId, kind: 'draw', phase });
    }
  }

  finish(action: HandAnimationAction): void {
    const suppressed = this.suppressedFinishes.get(action.eventId) ?? 0;
    if (suppressed > 0) {
      if (suppressed === 1) this.suppressedFinishes.delete(action.eventId);
      else this.suppressedFinishes.set(action.eventId, suppressed - 1);
      return;
    }
    const plan = this.plans.get(action.eventId);
    this.plans.delete(action.eventId);
    if (!plan) return;
    if (plan.localDiscardSnapshotReady) this.paintCommitBarrier.cancelPending();
    this.setRenderState((current) => ({
      active: current.active?.plan.action.eventId === action.eventId ? null : current.active,
      hiddenHandKeys: removeKey(current.hiddenHandKeys, plan.hiddenHandKey),
      hiddenRiverKeys: removeKey(current.hiddenRiverKeys, plan.hiddenRiverKey),
      hiddenMeldTileKeys: removeKeys(current.hiddenMeldTileKeys, plan.hiddenMeldTileKeys),
      hiddenRiichiSeats: removeKey(current.hiddenRiichiSeats, plan.hiddenRiichiSeat),
    }));
    if (plan.localDomDraw || plan.localDiscardSnapshotReady) {
      this.onLocalHandAnimationChange(null);
    }
  }

  clear(): void {
    this.paintCommitBarrier.cancelPending();
    this.plans.clear();
    this.suppressedFinishes.clear();
    this.sourceStore.clear();
    this.getLocalDiscardSnapshots()?.clear();
    this.onLocalHandAnimationChange(null);
    this.setRenderState(EMPTY_STATE);
  }
}

export function prepareTableAnimation3DRenderState(
  current: TableAnimation3DRenderState,
  plan: TableAnimation3DPlan,
): TableAnimation3DRenderState {
  return {
    active: { plan, phase: 'approach' },
    hiddenHandKeys: addKey(current.hiddenHandKeys, plan.hiddenHandKey),
    hiddenRiverKeys: addKey(current.hiddenRiverKeys, plan.hiddenRiverKey),
    hiddenMeldTileKeys: addKeys(current.hiddenMeldTileKeys, plan.hiddenMeldTileKeys),
    hiddenRiichiSeats: addKey(current.hiddenRiichiSeats, plan.hiddenRiichiSeat),
  };
}

export function transitionTableAnimation3DRenderState(
  current: TableAnimation3DRenderState,
  plan: TableAnimation3DPlan,
  phase: HandAnimationPhase,
): TableAnimation3DRenderState {
  const authoritativeVisible = phase === 'retreat';
  return {
    active: { plan, phase },
    hiddenHandKeys: authoritativeVisible
      ? removeKey(current.hiddenHandKeys, plan.hiddenHandKey)
      : current.hiddenHandKeys,
    hiddenRiverKeys: authoritativeVisible
      ? removeKey(current.hiddenRiverKeys, plan.hiddenRiverKey)
      : current.hiddenRiverKeys,
    hiddenMeldTileKeys: authoritativeVisible
      ? removeKeys(current.hiddenMeldTileKeys, plan.hiddenMeldTileKeys)
      : current.hiddenMeldTileKeys,
    hiddenRiichiSeats: authoritativeVisible
      ? removeKey(current.hiddenRiichiSeats, plan.hiddenRiichiSeat)
      : current.hiddenRiichiSeats,
  };
}

function map3DAnimationEvent(event: PresentationEvent): PresentationEvent | undefined {
  return event.type === 'tile_drawn'
    || event.type === 'tile_discarded'
    || event.type === 'riichi_declared'
    || event.type === 'meld_declared'
    ? event
    : undefined;
}

function isTableAnimation3DAction(action: HandAnimationAction): action is TableAnimation3DAction {
  return action.type === 'tile_drawn'
    || action.type === 'tile_discarded'
    || action.type === 'riichi_declared'
    || action.type === 'meld_declared';
}

function addKey<T>(source: ReadonlySet<T>, key?: T): ReadonlySet<T> {
  if (!key || source.has(key)) return source;
  return new Set([...source, key]);
}

function removeKey<T>(source: ReadonlySet<T>, key?: T): ReadonlySet<T> {
  if (!key || !source.has(key)) return source;
  const next = new Set(source);
  next.delete(key);
  return next;
}

function addKeys<T>(source: ReadonlySet<T>, keys?: readonly T[]): ReadonlySet<T> {
  if (!keys?.some((key) => !source.has(key))) return source;
  return new Set([...source, ...keys]);
}

function removeKeys<T>(source: ReadonlySet<T>, keys?: readonly T[]): ReadonlySet<T> {
  if (!keys?.some((key) => source.has(key))) return source;
  const next = new Set(source);
  keys.forEach((key) => next.delete(key));
  return next;
}

function trimSeenEvents(events: Set<string>): void {
  while (events.size > 128) {
    const oldest = events.values().next().value;
    if (oldest === undefined) break;
    events.delete(oldest);
  }
}

function nextPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

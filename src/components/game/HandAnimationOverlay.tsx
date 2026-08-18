import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { createTile } from '../../game/tileUtils';
import type { PlayerId } from '../../game/types';
import { AnimationScheduler } from '../../presentation/animation/AnimationScheduler';
import { DiscardSourceSnapshotStore, resolveDiscardMotion, type DiscardSourceFreshness, type PresentationRect } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import { HandAnimationConsumer } from '../../presentation/handAnimation/HandAnimationConsumer';
import { HandAnimationController, type HandAnimationAction, type HandAnimationPhase, type HandAnimationTarget } from '../../presentation/handAnimation/HandAnimationController';
import { RiverTileMask } from '../../presentation/handAnimation/RiverTileMask';
import { Tile } from '../Tile';
import { playersByPosition } from './MahjongTable';
import { RiichiStick } from './RiichiStick';
import './handAnimationOverlay.css';

export type VisualSeat = 'bottom' | 'left' | 'top' | 'right';
type OverlayPhase = 'enter' | HandAnimationPhase;

export interface HandAnimationPoint {
  readonly x: number;
  readonly y: number;
}

export interface HandAnimationGeometry {
  readonly entry: HandAnimationPoint;
  readonly source: HandAnimationPoint;
  readonly destination: HandAnimationPoint;
}

interface HandAnimationVisualState {
  readonly action: HandAnimationAction;
  readonly seat: VisualSeat;
  readonly phase: OverlayPhase;
  readonly point: HandAnimationPoint;
  readonly rotation: number;
  readonly geometry: HandAnimationGeometry;
}

interface HandAnimationOverlayProps {
  readonly bottomPlayerId: PlayerId;
  readonly discardSourceSnapshots: DiscardSourceSnapshotStore;
  readonly enabled?: boolean;
  readonly sessionKey: string;
  readonly turn: number;
}

export function HandAnimationOverlay({ bottomPlayerId, discardSourceSnapshots, enabled = true, sessionKey, turn }: HandAnimationOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<HandAnimationController | null>(null);
  const enabledRef = useRef(enabled);
  const freshnessRef = useRef<DiscardSourceFreshness>({ sessionKey, confirmedTurn: turn });
  const [visual, setVisual] = useState<HandAnimationVisualState | null>(null);
  enabledRef.current = enabled;
  freshnessRef.current = { sessionKey, confirmedTurn: turn };

  useEffect(() => {
    const riverMask = new RiverTileMask();
    const riichiStickMask = new RiverTileMask();
    const target = new DomHandAnimationTarget(overlayRef, setVisual, bottomPlayerId, riverMask, riichiStickMask);
    const scheduler = new AnimationScheduler();
    const controller = new HandAnimationController(target, scheduler, {
      maxQueuedActions: 6,
      onError: () => target.clear(),
    });
    const consumer = new HandAnimationConsumer(controller, undefined, () => enabledRef.current, undefined, (event) => {
      if (event.type !== 'tile_discarded') return event;
      const snapshot = discardSourceSnapshots.consume(event, freshnessRef.current);
      return snapshot ? { ...event, discardSourceRect: snapshot.sourceTileRect } : event;
    });
    controllerRef.current = controller;

    const reducedMotion = typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotionPreference = () => controller.setSkip(reducedMotion?.matches ?? false);
    applyMotionPreference();
    reducedMotion?.addEventListener('change', applyMotionPreference);

    return () => {
      reducedMotion?.removeEventListener('change', applyMotionPreference);
      consumer.dispose();
      controller.dispose();
      target.clear();
      discardSourceSnapshots.clear();
      controllerRef.current = null;
    };
  }, [bottomPlayerId, discardSourceSnapshots]);

  useEffect(() => {
    discardSourceSnapshots.clear();
    controllerRef.current?.cancelAll();
  }, [discardSourceSnapshots, enabled, sessionKey]);

  const proxyTile = visual?.action.type === 'tile_discarded'
    ? { ...createTile(visual.action.tile.id, visual.action.sequence), red: visual.action.tile.red }
    : null;
  const proxyIsSideways = visual?.action.type === 'tile_discarded' && visual.action.isRiichiDiscard;
  const showRiichiStickProxy = visual?.action.type === 'riichi_declared';
  const style = visual ? {
    left: `${visual.point.x}px`,
    top: `${visual.point.y}px`,
    '--hand-animation-rotation': `${visual.rotation}deg`,
  } as CSSProperties : undefined;

  return (
    <div
      ref={overlayRef}
      className="hand-animation-overlay"
      data-hand-animations-enabled={enabled ? 'true' : 'false'}
      aria-hidden="true"
    >
      {visual ? (
        <div
          key={visual.action.eventId}
          className="hand-animation-stage"
          data-animation-event={visual.action.eventId}
          data-animation-kind={animationKind(visual.action)}
          data-animation-meld-type={visual.action.type === 'meld_declared' ? visual.action.meldType : undefined}
          data-animation-phase={visual.phase}
          data-animation-seat={visual.seat}
          data-animation-source-x={visual.geometry.source.x}
          data-animation-source-y={visual.geometry.source.y}
          data-animation-target-x={visual.geometry.destination.x}
          data-animation-target-y={visual.geometry.destination.y}
          data-animation-spawn-x={visual.geometry.entry.x}
          data-animation-spawn-y={visual.geometry.entry.y}
          style={style}
        >
          <HandPlaceholder />
          {proxyTile ? (
            <span className={`hand-animation-proxy ${proxyIsSideways ? 'hand-animation-proxy--sideways' : ''}`}>
              <Tile tile={proxyTile} compact interactive={false} />
            </span>
          ) : null}
          {showRiichiStickProxy ? (
            <span className="hand-animation-stick-proxy">
              <RiichiStick orientation="horizontal" active />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function visualSeatForPlayer(playerId: PlayerId, bottomPlayerId: PlayerId): VisualSeat {
  const positions = playersByPosition(bottomPlayerId);
  if (positions.south === playerId) return 'bottom';
  if (positions.west === playerId) return 'left';
  if (positions.north === playerId) return 'top';
  return 'right';
}

export function createDrawGeometry(
  handRect: PresentationRect,
  overlayRect: PresentationRect,
  seat: VisualSeat,
): HandAnimationGeometry {
  const drawTarget = drawAnchorForSeat(handRect, overlayRect, seat);
  return {
    entry: spawnPointForSeat(overlayRect, drawTarget, seat),
    source: drawTarget,
    destination: drawTarget,
  };
}

export function createDiscardGeometry(
  sourceRect: PresentationRect,
  riverTargetRect: PresentationRect,
  overlayRect: PresentationRect,
  seat: VisualSeat,
): HandAnimationGeometry {
  const motion = resolveDiscardMotion(sourceRect, riverTargetRect, overlayRect);
  return {
    entry: spawnPointForSeat(overlayRect, motion.source, seat),
    source: motion.source,
    destination: motion.destination,
  };
}

export function createRiichiGeometry(
  handRect: PresentationRect,
  stickTargetRect: PresentationRect,
  overlayRect: PresentationRect,
  seat: VisualSeat,
): HandAnimationGeometry {
  const motion = resolveDiscardMotion(handRect, stickTargetRect, overlayRect);
  return {
    entry: spawnPointForSeat(overlayRect, motion.source, seat),
    source: motion.source,
    destination: motion.destination,
  };
}

export function createMeldGeometry(
  meldTargetRect: PresentationRect,
  overlayRect: PresentationRect,
  seat: VisualSeat,
): HandAnimationGeometry {
  const target = resolveDiscardMotion(meldTargetRect, meldTargetRect, overlayRect).destination;
  return {
    entry: spawnPointForSeat(overlayRect, target, seat),
    source: target,
    destination: target,
  };
}

class DomHandAnimationTarget implements HandAnimationTarget {
  constructor(
    private readonly overlayRef: RefObject<HTMLDivElement | null>,
    private readonly setVisual: Dispatch<SetStateAction<HandAnimationVisualState | null>>,
    private readonly bottomPlayerId: PlayerId,
    private readonly riverMask: RiverTileMask,
    private readonly riichiStickMask: RiverTileMask,
  ) {}

  beforeEnqueue(action: HandAnimationAction): boolean {
    if (action.type === 'tile_discarded') {
      const riverTile = this.findRiverTile(action);
      if (!riverTile) return false;
      this.riverMask.mask(action.eventId, riverTile);
    }
    if (action.type === 'riichi_declared') {
      const riichiStick = this.findRiichiStick(action);
      if (!riichiStick) return false;
      this.riichiStickMask.mask(action.eventId, riichiStick);
    }
    return true;
  }

  async prepare(action: HandAnimationAction): Promise<boolean> {
    this.resetHandVisual();
    const overlay = this.overlayRef.current;
    const scene = overlay?.closest<HTMLElement>('.game-screen');
    if (!overlay || !scene) return false;

    const seat = visualSeatForPlayer(action.playerId, this.bottomPlayerId);
    const overlayRect = overlay.getBoundingClientRect();
    let geometry: HandAnimationGeometry;
    if (action.type === 'meld_declared') {
      const meldAnchor = this.findMeldAnchor(action);
      if (!meldAnchor) return false;
      geometry = createMeldGeometry(meldAnchor.getBoundingClientRect(), overlayRect, seat);
    } else {
      const handElement = scene.querySelector<HTMLElement>(`[data-local-player="${action.playerId}"] .local-hand-row`)
        ?? scene.querySelector<HTMLElement>(`[data-player-index="${action.playerId}"] .player-zone-hand-wrap`);
      if (!handElement) return false;

      const handRect = handElement.getBoundingClientRect();
      geometry = createDrawGeometry(handRect, overlayRect, seat);
      if (action.type === 'tile_discarded') {
        const riverTile = this.findRiverTile(action);
        if (!riverTile) return false;
        this.riverMask.mask(action.eventId, riverTile);
        geometry = createDiscardGeometry(
          action.discardSourceRect ?? handRect,
          riverTile.getBoundingClientRect(),
          overlayRect,
          seat,
        );
      }
      if (action.type === 'riichi_declared') {
        const riichiStick = this.findRiichiStick(action);
        if (!riichiStick) return false;
        this.riichiStickMask.mask(action.eventId, riichiStick);
        geometry = createRiichiGeometry(handRect, riichiStick.getBoundingClientRect(), overlayRect, seat);
      }
    }

    this.setVisual({
      action,
      seat,
      phase: 'enter',
      point: geometry.entry,
      rotation: seatRotation(seat),
      geometry,
    });
    await nextPaint();
    return true;
  }

  setPhase(action: HandAnimationAction, phase: HandAnimationPhase): void {
    if (phase === 'release' && action.type === 'tile_discarded') this.riverMask.reveal(action.eventId);
    if (phase === 'release' && action.type === 'riichi_declared') this.riichiStickMask.reveal(action.eventId);
    this.setVisual((current) => {
      if (!current || current.action.eventId !== action.eventId) return current;
      return { ...current, phase, point: pointForPhase(current.geometry, phase) };
    });
  }

  finish(action: HandAnimationAction): void {
    this.riverMask.reveal(action.eventId);
    this.riichiStickMask.reveal(action.eventId);
    this.setVisual((current) => current?.action.eventId === action.eventId ? null : current);
  }

  clear(): void {
    this.riverMask.revealAll();
    this.riichiStickMask.revealAll();
    this.resetHandVisual();
  }

  private findRiverTile(action: Extract<HandAnimationAction, { type: 'tile_discarded' }>): HTMLElement | null {
    const scene = this.overlayRef.current?.closest<HTMLElement>('.game-screen');
    return scene?.querySelector<HTMLElement>(`[data-river-player="${action.playerId}"] [data-river-index="${action.riverIndex}"]`) ?? null;
  }

  private findRiichiStick(action: Extract<HandAnimationAction, { type: 'riichi_declared' }>): HTMLElement | null {
    const scene = this.overlayRef.current?.closest<HTMLElement>('.game-screen');
    return scene?.querySelector<HTMLElement>(`[data-riichi-player="${action.playerId}"] .riichi-stick-slot`) ?? null;
  }

  private findMeldAnchor(action: Extract<HandAnimationAction, { type: 'meld_declared' }>): HTMLElement | null {
    const scene = this.overlayRef.current?.closest<HTMLElement>('.game-screen');
    return scene?.querySelector<HTMLElement>(`[data-meld-player="${action.playerId}"]`) ?? null;
  }

  private resetHandVisual(): void {
    this.setVisual(null);
  }
}

function HandPlaceholder() {
  return (
    <svg className="hand-animation-hand" viewBox="0 0 120 96" role="presentation">
      <path d="M20 89c-7-12-7-28 2-39l24-31c4-5 12-4 14 2l1 3 9-15c4-6 13-4 14 3l1 5 6-7c5-5 13-1 12 6l-2 13 4-2c8-4 15 4 11 12L96 77c-6 11-18 18-31 18H31c-5 0-9-2-11-6Z" />
      <path className="hand-animation-hand__highlight" d="M28 82c-4-10-2-20 5-29l22-27m11 45c13-8 22-19 29-34" />
    </svg>
  );
}

function drawAnchorForSeat(handRect: PresentationRect, overlayRect: PresentationRect, seat: VisualSeat): HandAnimationPoint {
  const inset = Math.min(24, Math.max(12, Math.min(handRect.width, handRect.height) * 0.15));
  const centerX = handRect.left + handRect.width / 2 - overlayRect.left;
  const centerY = handRect.top + handRect.height / 2 - overlayRect.top;
  if (seat === 'bottom') return { x: handRect.left + handRect.width - overlayRect.left - inset, y: centerY };
  if (seat === 'top') return { x: handRect.left - overlayRect.left + inset, y: centerY };
  if (seat === 'left') return { x: centerX, y: handRect.top + handRect.height - overlayRect.top - inset };
  return { x: centerX, y: handRect.top - overlayRect.top + inset };
}

export function spawnPointForSeat(
  overlayRect: PresentationRect,
  actionSource: HandAnimationPoint,
  seat: VisualSeat,
): HandAnimationPoint {
  if (seat === 'bottom') return { x: actionSource.x, y: overlayRect.height + 80 };
  if (seat === 'top') return { x: actionSource.x, y: -80 };
  if (seat === 'left') return { x: -100, y: actionSource.y };
  return { x: overlayRect.width + 100, y: actionSource.y };
}

function pointForPhase(geometry: HandAnimationGeometry, phase: HandAnimationPhase): HandAnimationPoint {
  if (phase === 'approach' || phase === 'grasp') return geometry.source;
  if (phase === 'travel' || phase === 'release') return geometry.destination;
  return geometry.entry;
}

function seatRotation(seat: VisualSeat): number {
  if (seat === 'left') return 90;
  if (seat === 'top') return 180;
  if (seat === 'right') return -90;
  return 0;
}

function nextPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function animationKind(action: HandAnimationAction): 'draw' | 'discard' | 'riichi' | 'meld' {
  if (action.type === 'tile_drawn') return 'draw';
  if (action.type === 'tile_discarded') return 'discard';
  if (action.type === 'riichi_declared') return 'riichi';
  return 'meld';
}

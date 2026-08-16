import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { createTile } from '../../game/tileUtils';
import type { PlayerId } from '../../game/types';
import { AnimationScheduler } from '../../presentation/animation/AnimationScheduler';
import { centerInOverlay, DiscardSourceSnapshotStore, resolveDiscardMotion, type DiscardSourceFreshness } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import { HandAnimationConsumer } from '../../presentation/handAnimation/HandAnimationConsumer';
import { HandAnimationController, type HandAnimationAction, type HandAnimationPhase, type HandAnimationTarget } from '../../presentation/handAnimation/HandAnimationController';
import { RiverTileMask } from '../../presentation/handAnimation/RiverTileMask';
import { Tile } from '../Tile';
import { playersByPosition } from './MahjongTable';
import './handAnimationOverlay.css';

type VisualSeat = 'bottom' | 'left' | 'top' | 'right';
type OverlayPhase = 'enter' | HandAnimationPhase;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface AnimationGeometry {
  readonly entry: Point;
  readonly source: Point;
  readonly destination: Point;
}

interface HandAnimationVisualState {
  readonly action: HandAnimationAction;
  readonly seat: VisualSeat;
  readonly phase: OverlayPhase;
  readonly point: Point;
  readonly rotation: number;
  readonly geometry: AnimationGeometry;
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
    const mask = new RiverTileMask();
    const target = new DomHandAnimationTarget(overlayRef, setVisual, bottomPlayerId, mask);
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
          className="hand-animation-stage"
          data-animation-event={visual.action.eventId}
          data-animation-kind={visual.action.type === 'tile_drawn' ? 'draw' : 'discard'}
          data-animation-phase={visual.phase}
          data-animation-seat={visual.seat}
          data-animation-source-x={visual.geometry.source.x}
          data-animation-source-y={visual.geometry.source.y}
          data-animation-target-x={visual.geometry.destination.x}
          data-animation-target-y={visual.geometry.destination.y}
          style={style}
        >
          <HandPlaceholder />
          <span className={`hand-animation-proxy ${visual.action.type === 'tile_discarded' && visual.action.isRiichiDiscard ? 'hand-animation-proxy--sideways' : ''}`}>
            {proxyTile
              ? <Tile tile={proxyTile} compact interactive={false} />
              : <Tile compact faceDown interactive={false} />}
          </span>
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

class DomHandAnimationTarget implements HandAnimationTarget {
  constructor(
    private readonly overlayRef: RefObject<HTMLDivElement | null>,
    private readonly setVisual: Dispatch<SetStateAction<HandAnimationVisualState | null>>,
    private readonly bottomPlayerId: PlayerId,
    private readonly riverMask: RiverTileMask,
  ) {}

  beforeEnqueue(action: HandAnimationAction): boolean {
    if (action.type !== 'tile_discarded') return true;
    const riverTile = this.findRiverTile(action);
    if (!riverTile) return false;
    this.riverMask.mask(action.eventId, riverTile);
    return true;
  }

  async prepare(action: HandAnimationAction): Promise<boolean> {
    const overlay = this.overlayRef.current;
    const scene = overlay?.closest<HTMLElement>('.game-screen');
    const table = scene?.querySelector<HTMLElement>('.mahjong-table');
    if (!overlay || !scene || !table) return false;

    const seat = visualSeatForPlayer(action.playerId, this.bottomPlayerId);
    const overlayRect = overlay.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const handElement = scene.querySelector<HTMLElement>(`[data-local-player="${action.playerId}"] .local-hand-row`)
      ?? scene.querySelector<HTMLElement>(`[data-player-index="${action.playerId}"] .player-zone-hand-wrap`);
    if (!handElement) return false;

    const handRect = handElement.getBoundingClientRect();
    const handPoint = centerInOverlay(handRect, overlayRect);
    const drawPoint = drawAnchorInOverlay(tableRect, overlayRect, seat);
    let source = action.type === 'tile_drawn' ? drawPoint : handPoint;
    let destination = handPoint;
    if (action.type === 'tile_discarded') {
      const riverTile = this.findRiverTile(action);
      if (!riverTile) return false;
      const motion = resolveDiscardMotion(action.discardSourceRect ?? handRect, riverTile.getBoundingClientRect(), overlayRect);
      source = motion.source;
      destination = motion.destination;
      this.riverMask.mask(action.eventId, riverTile);
    }

    const geometry: AnimationGeometry = {
      entry: entryPoint(overlayRect, handPoint, seat),
      source,
      destination,
    };
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
    this.setVisual((current) => {
      if (!current || current.action.eventId !== action.eventId) return current;
      return { ...current, phase, point: pointForPhase(current.geometry, phase) };
    });
  }

  finish(action: HandAnimationAction): void {
    this.riverMask.reveal(action.eventId);
    this.setVisual((current) => current?.action.eventId === action.eventId ? null : current);
  }

  clear(): void {
    this.riverMask.revealAll();
    this.setVisual(null);
  }

  private findRiverTile(action: Extract<HandAnimationAction, { type: 'tile_discarded' }>): HTMLElement | null {
    const scene = this.overlayRef.current?.closest<HTMLElement>('.game-screen');
    return scene?.querySelector<HTMLElement>(`[data-river-player="${action.playerId}"] [data-river-index="${action.riverIndex}"]`) ?? null;
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

function drawAnchorInOverlay(tableRect: DOMRect, overlayRect: DOMRect, seat: VisualSeat): Point {
  const inset = Math.min(92, Math.max(56, Math.min(tableRect.width, tableRect.height) * 0.1));
  const centerX = tableRect.left + tableRect.width / 2 - overlayRect.left;
  const centerY = tableRect.top + tableRect.height / 2 - overlayRect.top;
  if (seat === 'bottom') return { x: centerX, y: tableRect.bottom - overlayRect.top - inset };
  if (seat === 'top') return { x: centerX, y: tableRect.top - overlayRect.top + inset };
  if (seat === 'left') return { x: tableRect.left - overlayRect.left + inset, y: centerY };
  return { x: tableRect.right - overlayRect.left - inset, y: centerY };
}

function entryPoint(overlayRect: DOMRect, handPoint: Point, seat: VisualSeat): Point {
  if (seat === 'bottom') return { x: handPoint.x, y: overlayRect.height + 80 };
  if (seat === 'top') return { x: handPoint.x, y: -80 };
  if (seat === 'left') return { x: -100, y: handPoint.y };
  return { x: overlayRect.width + 100, y: handPoint.y };
}

function pointForPhase(geometry: AnimationGeometry, phase: HandAnimationPhase): Point {
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

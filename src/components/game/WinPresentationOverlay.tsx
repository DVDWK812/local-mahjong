import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { getPresentationFeatures } from '../../config/presentationFeatures';
import type { GameState, PlayerId, Tile as TileModel } from '../../game/types';
import { AnimationScheduler } from '../../presentation/animation/AnimationScheduler';
import { presentationEventBus } from '../../presentation/PresentationEventBus';
import { presentationPacingGate } from '../../presentation/pacing/PresentationPacingGate';
import { WinPresentationConsumer } from '../../presentation/winAnimation/WinPresentationConsumer';
import {
  WinPresentationController,
  type WinPresentationAction,
  type WinPresentationPhase,
  type WinPresentationTarget,
} from '../../presentation/winAnimation/WinPresentationController';
import { Tile } from '../Tile';
import { playersByPosition } from './MahjongTable';
import type { VisualSeat } from './HandAnimationOverlay';
import './winPresentationOverlay.css';

type OverlayPhase = 'ready' | WinPresentationPhase;

interface WinPresentationVisualState {
  readonly action: WinPresentationAction;
  readonly seat: VisualSeat;
  readonly phase: OverlayPhase;
  readonly tiles: readonly TileModel[];
  readonly drawnTileInstanceId: string | null;
  readonly sourceX: number;
  readonly sourceY: number;
  readonly pushX: number;
  readonly pushY: number;
}

interface WinPresentationOverlayProps {
  readonly gameState: GameState;
  readonly bottomPlayerId: PlayerId;
  readonly enabled: boolean;
  readonly onRoundEndSettled?: () => void;
}

export function WinPresentationOverlay({ gameState, bottomPlayerId, enabled, onRoundEndSettled }: WinPresentationOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef(gameState);
  const enabledRef = useRef(enabled);
  const onRoundEndSettledRef = useRef(onRoundEndSettled);
  const controllerRef = useRef<WinPresentationController | null>(null);
  const [visual, setVisual] = useState<WinPresentationVisualState | null>(null);
  gameStateRef.current = gameState;
  enabledRef.current = enabled;
  onRoundEndSettledRef.current = onRoundEndSettled;

  useEffect(() => {
    const target = new DomWinPresentationTarget(overlayRef, setVisual, gameStateRef, bottomPlayerId);
    const controller = new WinPresentationController(target, new AnimationScheduler(), presentationPacingGate, {
      onError: () => target.clear(),
      onSettled: (action) => {
        presentationPacingGate.complete(action.eventId);
        if (presentationPacingGate.pendingCount === 0) onRoundEndSettledRef.current?.();
      },
    });
    const consumer = new WinPresentationConsumer(
      presentationEventBus,
      controller,
      presentationPacingGate,
      () => enabledRef.current && getPresentationFeatures().presentationEvents && getPresentationFeatures().handAnimations,
    );
    controllerRef.current = controller;
    consumer.start();
    return () => {
      consumer.dispose();
      controller.dispose();
      controllerRef.current = null;
      target.clear();
    };
  }, [bottomPlayerId]);

  useEffect(() => {
    if (enabled) return;
    controllerRef.current?.cancelAll();
  }, [enabled]);

  const style = visual ? ({
    '--win-source-x': `${visual.sourceX}px`,
    '--win-source-y': `${visual.sourceY}px`,
    '--win-push-x': `${visual.pushX}px`,
    '--win-push-y': `${visual.pushY}px`,
  } as CSSProperties) : undefined;

  return (
    <div className="win-presentation-overlay" data-testid="win-presentation-overlay" ref={overlayRef} aria-hidden="true">
      {visual ? (
        <div
          className="win-presentation-stage"
          data-win-type={visual.action.winType}
          data-win-seat={visual.seat}
          data-win-phase={visual.phase}
          style={style}
        >
          <div className="win-presentation-hand">
            {visual.tiles.map((tile) => (
              <span
                className={tile.instanceId === visual.drawnTileInstanceId ? 'win-presentation-tile win-presentation-tile--drawn' : 'win-presentation-tile'}
                key={tile.instanceId}
              >
                <Tile tile={tile} compact interactive={false} />
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

class DomWinPresentationTarget implements WinPresentationTarget {
  private highlightedDiscard: HTMLElement | null = null;

  constructor(
    private readonly overlayRef: RefObject<HTMLDivElement | null>,
    private readonly setVisual: Dispatch<SetStateAction<WinPresentationVisualState | null>>,
    private readonly gameStateRef: RefObject<GameState>,
    private readonly bottomPlayerId: PlayerId,
  ) {}

  prepare(action: WinPresentationAction): boolean {
    const overlay = this.overlayRef.current;
    const scene = overlay?.closest<HTMLElement>('.game-screen');
    const gameState = this.gameStateRef.current;
    const result = gameState.result;
    const winner = result && (result.type === 'ron' || result.type === 'tsumo')
      ? result.winners.find((candidate) => candidate.winner === action.playerId)
      : undefined;
    if (!overlay || !scene || !winner) return false;

    const seat = seatForPlayer(action.playerId, this.bottomPlayerId);
    const handElement = scene.querySelector<HTMLElement>(`[data-local-player="${action.playerId}"] .local-hand-row`)
      ?? scene.querySelector<HTMLElement>(`[data-player-index="${action.playerId}"] .player-zone-hand-wrap`);
    if (!handElement) return false;

    const overlayRect = overlay.getBoundingClientRect();
    const handRect = handElement.getBoundingClientRect();
    const sourceX = handRect.left - overlayRect.left + handRect.width / 2;
    const sourceY = handRect.top - overlayRect.top + handRect.height / 2;
    const push = inwardPushVector(seat, overlayRect, sourceX, sourceY);

    this.removeHighlight();
    if (action.winType === 'ron') {
      this.highlightedDiscard = resolveWinningDiscard(scene, action, winner.from, gameState);
      this.highlightedDiscard?.classList.add('win-presentation-winning-discard');
    }

    this.setVisual({
      action,
      seat,
      phase: 'ready',
      tiles: gameState.players[action.playerId].hand,
      drawnTileInstanceId: action.winType === 'tsumo'
        ? gameState.players[action.playerId].drawnTile?.instanceId ?? winner.winTile.instanceId
        : null,
      sourceX,
      sourceY,
      pushX: push.x,
      pushY: push.y,
    });
    return true;
  }

  setPhase(action: WinPresentationAction, phase: WinPresentationPhase): void {
    this.setVisual((current) => current?.action.eventId === action.eventId ? { ...current, phase } : current);
  }

  finish(action: WinPresentationAction): void {
    this.removeHighlight();
    this.setVisual((current) => current?.action.eventId === action.eventId ? null : current);
  }

  clear(): void {
    this.removeHighlight();
    this.setVisual(null);
  }

  private removeHighlight(): void {
    this.highlightedDiscard?.classList.remove('win-presentation-winning-discard');
    this.highlightedDiscard = null;
  }
}

export function seatForPlayer(playerId: PlayerId, bottomPlayerId: PlayerId): VisualSeat {
  const positions = playersByPosition(bottomPlayerId);
  if (positions.south === playerId) return 'bottom';
  if (positions.north === playerId) return 'top';
  if (positions.west === playerId) return 'left';
  return 'right';
}

export function inwardPushVector(seat: VisualSeat, sceneRect: Pick<DOMRect, 'width' | 'height'>, sourceX: number, sourceY: number): { x: number; y: number } {
  const towardCenterX = sceneRect.width / 2 - sourceX;
  const towardCenterY = sceneRect.height / 2 - sourceY;
  if (seat === 'bottom') return { x: towardCenterX * 0.18, y: -Math.max(72, Math.abs(towardCenterY) * 0.28) };
  if (seat === 'top') return { x: towardCenterX * 0.18, y: Math.max(72, Math.abs(towardCenterY) * 0.28) };
  if (seat === 'left') return { x: Math.max(72, Math.abs(towardCenterX) * 0.28), y: towardCenterY * 0.18 };
  return { x: -Math.max(72, Math.abs(towardCenterX) * 0.28), y: towardCenterY * 0.18 };
}

function resolveWinningDiscard(
  scene: HTMLElement,
  action: WinPresentationAction,
  discarder: PlayerId | null,
  gameState: GameState,
): HTMLElement | null {
  const source = action.sourceDiscard;
  if (source) {
    return scene.querySelector<HTMLElement>(`[data-river-player="${source.playerId}"] [data-river-index="${source.riverIndex}"]`);
  }
  if (discarder === null) return null;
  const riverIndex = gameState.players[discarder].river.length - 1;
  return riverIndex < 0
    ? null
    : scene.querySelector<HTMLElement>(`[data-river-player="${discarder}"] [data-river-index="${riverIndex}"]`);
}

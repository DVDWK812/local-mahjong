import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { getPresentationFeatures } from '../../config/presentationFeatures';
import type { PlayerId } from '../../game/types';
import { AnimationScheduler } from '../../presentation/animation/AnimationScheduler';
import { EventOverlayConsumer } from '../../presentation/eventOverlay/EventOverlayConsumer';
import {
  EventOverlayController,
  eventOverlayIntensity,
  eventOverlayLabel,
  type EventOverlayAction,
  type EventOverlayPhase,
  type EventOverlayTarget,
} from '../../presentation/eventOverlay/EventOverlayController';
import { presentationEventBus } from '../../presentation/PresentationEventBus';
import { presentationPacingGate } from '../../presentation/pacing/PresentationPacingGate';
import { playersByPosition } from './MahjongTable';
import type { VisualSeat } from './HandAnimationOverlay';
import './gameEventOverlay.css';

interface GameEventOverlayProps {
  readonly bottomPlayerId: PlayerId;
  readonly enabled: boolean;
  readonly onRoundEndSettled?: () => void;
}

interface GameEventOverlayVisual {
  readonly action: EventOverlayAction;
  readonly phase: EventOverlayPhase;
}

export function GameEventOverlay({ bottomPlayerId, enabled, onRoundEndSettled }: GameEventOverlayProps) {
  const enabledRef = useRef(enabled);
  const onRoundEndSettledRef = useRef(onRoundEndSettled);
  const controllerRef = useRef<EventOverlayController | null>(null);
  const [visual, setVisual] = useState<GameEventOverlayVisual | null>(null);
  enabledRef.current = enabled;
  onRoundEndSettledRef.current = onRoundEndSettled;

  useEffect(() => {
    const target = new ReactEventOverlayTarget(setVisual);
    const controller = new EventOverlayController(target, new AnimationScheduler(), presentationPacingGate, {
      onError: () => target.clear(),
      onSettled: (action) => {
        presentationPacingGate.complete(action.eventId);
        if ((action.type === 'win_declared' || action.type === 'round_end_announced')
          && presentationPacingGate.pendingCount === 0) {
          onRoundEndSettledRef.current?.();
        }
      },
    });
    const consumer = new EventOverlayConsumer(
      controller,
      presentationPacingGate,
      presentationEventBus,
      () => enabledRef.current,
      getPresentationFeatures,
    );
    controllerRef.current = controller;
    consumer.start();

    const reducedMotion = typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotionPreference = () => controller.setSkip(reducedMotion?.matches ?? false);
    applyMotionPreference();
    reducedMotion?.addEventListener('change', applyMotionPreference);

    return () => {
      reducedMotion?.removeEventListener('change', applyMotionPreference);
      consumer.dispose();
      controller.dispose();
      controllerRef.current = null;
      target.clear();
    };
  }, []);

  useEffect(() => {
    if (enabled) return;
    controllerRef.current?.cancelAll();
  }, [enabled]);

  const seat = visual ? eventSeatForAction(visual.action, bottomPlayerId) : null;
  return (
    <div
      className="game-event-overlay"
      data-testid="game-event-overlay"
      data-event-overlays-enabled={enabled ? 'true' : 'false'}
      aria-live="polite"
      aria-atomic="true"
    >
      {visual && seat ? (
        <div
          key={visual.action.eventId}
          className="game-event-overlay-stage"
          data-event-id={visual.action.eventId}
          data-event-kind={eventKind(visual.action)}
          data-event-intensity={eventOverlayIntensity(visual.action)}
          data-event-seat={seat}
          data-event-phase={visual.phase}
        >
          <strong className="game-event-overlay-label">{eventOverlayLabel(visual.action)}</strong>
          {seat === 'center' ? null : <span className="game-event-overlay-seat">{eventSeatLabel(seat)}</span>}
        </div>
      ) : null}
    </div>
  );
}

class ReactEventOverlayTarget implements EventOverlayTarget {
  constructor(private readonly setVisual: Dispatch<SetStateAction<GameEventOverlayVisual | null>>) {}

  prepare(action: EventOverlayAction): boolean {
    this.setVisual({ action, phase: 'lead-in' });
    return true;
  }

  setPhase(action: EventOverlayAction, phase: EventOverlayPhase): void {
    this.setVisual((current) => current?.action.eventId === action.eventId ? { action, phase } : current);
  }

  finish(action: EventOverlayAction): void {
    this.setVisual((current) => current?.action.eventId === action.eventId ? null : current);
  }

  clear(): void {
    this.setVisual(null);
  }
}

export function eventSeatForPlayer(playerId: PlayerId, bottomPlayerId: PlayerId): VisualSeat {
  const positions = playersByPosition(bottomPlayerId);
  if (positions.south === playerId) return 'bottom';
  if (positions.north === playerId) return 'top';
  if (positions.west === playerId) return 'left';
  return 'right';
}

export function eventSeatForAction(action: EventOverlayAction, bottomPlayerId: PlayerId): VisualSeat | 'center' {
  return action.type === 'round_end_announced' ? 'center' : eventSeatForPlayer(action.playerId, bottomPlayerId);
}

function eventSeatLabel(seat: VisualSeat): string {
  if (seat === 'bottom') return '本家';
  if (seat === 'top') return '对家';
  if (seat === 'left') return '左家';
  return '右家';
}

function eventKind(action: EventOverlayAction): 'riichi' | 'chi' | 'pon' | 'kan' | 'ron' | 'tsumo' | 'draw' | 'abortive-draw' {
  if (action.type === 'round_end_announced') return action.settlementType === 'exhaustive-draw' ? 'draw' : 'abortive-draw';
  if (action.type === 'riichi_declared') return 'riichi';
  if (action.type === 'meld_declared') return action.meldType;
  return action.winType;
}

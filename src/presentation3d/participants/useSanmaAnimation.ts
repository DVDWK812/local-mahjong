import { useLayoutEffect, useRef, useState } from 'react';
import type { Tile, PlayerId } from '../../game/types';
import type { HandPack } from '../../hand/handPacks';
import { HandAnimationConsumer } from '../../presentation/handAnimation/HandAnimationConsumer';
import { HandAnimationController, HAND_ANIMATION_PHASES, type HandAnimationAction, type HandAnimationPhase, type HandAnimationTarget } from '../../presentation/handAnimation/HandAnimationController';
import { AnimationScheduler, animationFrameTask } from '../../presentation/animation/AnimationScheduler';
import { createHandPresentationSnapshot, type HandPresentationFrame } from '../../presentation/handAnimation/HandPresentationSnapshot';
import type { PresentationRect } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import { presentationPacingGate } from '../../presentation/pacing/PresentationPacingGate';
import type { Table3DSeat } from '../coordinates/seatTransforms';

export interface SanmaMotionSource { seat: Table3DSeat; tile: Tile | null; count: number; river: readonly Tile[]; pack: HandPack; rect?: PresentationRect }
export interface SanmaMotionFrame extends SanmaMotionSource { action: HandAnimationAction; playerId: PlayerId; local: boolean; phase: HandAnimationPhase; progress: number; history: HandPresentationFrame['snapshot'] | null }
export function sanmaHandFrame(frame: SanmaMotionFrame): HandPresentationFrame | undefined {
  return frame.history ? { snapshot: frame.history, phase: frame.phase === 'approach' || frame.phase === 'grasp' ? 'lift' : frame.phase === 'travel' ? 'carry' : frame.phase === 'release' ? 'river-settle' : 'reorder', progress: frame.progress } : undefined;
}

/** An adapter to the shared finite scheduler. Rules and decision clocks never wait here. */
export function useSanmaAnimation(session: string, enabled: boolean, source: (action: HandAnimationAction) => SanmaMotionSource | null) {
  const [frame, setFrame] = useState<SanmaMotionFrame | null>(null);
  const live = useRef({ enabled, source }); live.current = { enabled, source };
  const controller = useRef<HandAnimationController | null>(null);
  useLayoutEffect(() => {
    let mounted = true, current: SanmaMotionFrame | null = null;
    const snapshots = new Map<string, SanmaMotionFrame>();
    const publish = (value: SanmaMotionFrame | null) => { current = value; if (mounted) setFrame(value); };
    const target: HandAnimationTarget = {
      beforeEnqueue(action) {
        const data = live.current.source(action); if (!data) return false;
        snapshots.set(action.eventId, { ...data, action, playerId: action.playerId, local: data.seat === 'bottom', phase: 'approach', progress: 0,
          history: action.type === 'tile_discarded' ? createHandPresentationSnapshot(action, data.seat === 'bottom') : null });
      },
      prepare(action) { const f = snapshots.get(action.eventId); if (!f) return false; publish(f); return true; },
      animationTasks(action, cue) { return HAND_ANIMATION_PHASES.map(({ phase, durationMs }) => animationFrameTask(durationMs, progress => {
        if (current?.action.eventId === action.eventId) publish({ ...current, phase, progress });
      }, progress => cue?.(phase, progress))); },
      setPhase() {},
      finish(action) { snapshots.delete(action.eventId); if (current?.action.eventId === action.eventId) publish(null); },
      clear() { snapshots.clear(); if (current) presentationPacingGate.complete(current.action.eventId); publish(null); },
    };
    const c = new HandAnimationController(target, new AnimationScheduler(), { onSettled: action => presentationPacingGate.complete(action.eventId), snapOnPlaybackChange: true });
    controller.current = c;
    const consumer = new HandAnimationConsumer(c, undefined, () => live.current.enabled, undefined, event => event.type === 'tile_drawn' || event.type === 'tile_discarded' || event.type === 'meld_declared' || event.type === 'riichi_declared' ? event : undefined, presentationPacingGate);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'), update = () => c.setReducedMotion(media.matches);
    update(); media.addEventListener('change', update);
    return () => { mounted = false; consumer.dispose(); c.dispose(); media.removeEventListener('change', update); controller.current = null; };
  }, [session]);
  useLayoutEffect(() => { if (!enabled) { controller.current?.cancelAll(); setFrame(null); } }, [enabled]);
  return frame;
}

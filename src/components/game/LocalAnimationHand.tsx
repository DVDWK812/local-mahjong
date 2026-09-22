import { useLayoutEffect, useRef } from 'react';
import type { LocalHandAnimation3DState } from '../../presentation3d/animation/tableAnimation3D';
import type { PresentationRect } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import { HandVisualController } from '../../hand/HandVisualController';
import { DEFAULT_HAND_PACK, type HandPack } from '../../hand/handPacks';
import { resolveLocalDiscardRect } from './LocalHandSnapshot';

export function localHandContact(rect: PresentationRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width * 1.9 };
}

/** Real DOM source/proxy rects remain the contact authority. */
export function LocalAnimationHand({ animation, pack = DEFAULT_HAND_PACK, playerId }: {
  animation: LocalHandAnimation3DState;
  pack?: HandPack;
  playerId?: number;
}) {
  const ref = useRef<HandVisualController | null>(null);
  useLayoutEffect(() => {
    const controller = new HandVisualController(animation.eventId, 'bottom', pack, playerId);
    ref.current = controller;
    return () => { controller.dispose(); ref.current = null; };
  }, [animation.eventId, pack, playerId]);
  useLayoutEffect(() => {
    const position = () => {
      const controller = ref.current;
      if (!controller) return;
      const frame = animation.handPresentation;
      const drawn = document.querySelector<HTMLElement>('.local-hand-area--screen-space .drawn-tile-gap .tile');
      let rect = frame && animation.discardMotion
        ? resolveLocalDiscardRect(frame, animation.discardMotion)
        : animation.kind === 'draw' ? drawn?.getBoundingClientRect() : undefined;
      if (frame && !frame.snapshot.isTsumogiri && ['gap-hold', 'insert', 'reorder', 'complete'].includes(frame.phase)) {
        const index = frame.snapshot.drawnTile ? frame.snapshot.visualHand.length - 1
          : Math.max(0, frame.snapshot.discardVisualSlot - 1);
        rect = document.querySelector<HTMLElement>(`.local-hand-area--screen-space [data-hand-slot-index="${index}"] .tile`)?.getBoundingClientRect();
        if (frame.phase === 'gap-hold' && animation.discardMotion && rect) {
          rect = returnToDrawnRect(animation.discardMotion.destination, animation.discardMotion.drawnSource ?? rect, frame.progress);
        }
      }
      if (!rect || !rect.width || !rect.height) { controller.hide(); return; }
      const contact = localHandContact(rect);
      const phase = frame && !frame.snapshot.isTsumogiri && frame.snapshot.drawnTile
        ? frame.phase === 'gap-hold' ? 'travel' : frame.phase === 'insert' ? frame.progress < 0.2 ? 'grasp' : 'carry'
          : frame.phase === 'reorder' ? 'release' : frame.phase === 'complete' ? 'retreat' : frame.phase
        : frame?.phase ?? animation.phase;
      controller.update({ ...contact, width: rect.width }, phase,
        frame?.progress ?? animation.progress ?? 0, frame?.snapshot.isTsumogiri);
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [animation]);
  return null;
}

/** Continuous return from the river to the captured, actual drawn DOM tile. */
export function returnToDrawnRect(from: PresentationRect, to: PresentationRect, progress: number): PresentationRect {
  const p = Math.max(0, Math.min(1, progress));
  const t = p * p * (3 - 2 * p);
  return { left: from.left + (to.left - from.left) * t, top: from.top + (to.top - from.top) * t,
    width: from.width + (to.width - from.width) * t, height: from.height + (to.height - from.height) * t };
}

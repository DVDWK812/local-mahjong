import { useLayoutEffect, useRef } from 'react';
import type { LocalHandAnimation3DState } from '../../presentation3d/animation/tableAnimation3D';
import type { PresentationRect } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import { HandVisualController } from '../../hand/HandVisualController';
import { resolveLocalDiscardRect } from './LocalHandSnapshot';

export function localHandContact(rect: PresentationRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width * 1.9 };
}

/** Real DOM source/proxy rects remain the contact authority. */
export function LocalAnimationHand({ animation }: { animation: LocalHandAnimation3DState }) {
  const ref = useRef<HandVisualController | null>(null);
  useLayoutEffect(() => {
    const controller = new HandVisualController(animation.eventId, 'bottom');
    ref.current = controller;
    return () => { controller.dispose(); ref.current = null; };
  }, [animation.eventId]);
  useLayoutEffect(() => {
    const position = () => {
      const controller = ref.current;
      if (!controller) return;
      const frame = animation.handPresentation;
      const drawn = document.querySelector<HTMLElement>('.local-hand-area--screen-space .drawn-tile-gap .tile');
      let rect = frame && animation.discardMotion
        ? resolveLocalDiscardRect(frame, animation.discardMotion)
        : animation.kind === 'draw' ? drawn?.getBoundingClientRect() : undefined;
      if (frame && !frame.snapshot.isTsumogiri && ['insert', 'reorder', 'complete'].includes(frame.phase)) {
        const index = frame.snapshot.drawnTile ? frame.snapshot.visualHand.length - 1
          : Math.max(0, frame.snapshot.discardVisualSlot - 1);
        rect = document.querySelector<HTMLElement>(`.local-hand-area--screen-space [data-hand-slot-index="${index}"] .tile`)?.getBoundingClientRect();
      }
      if (!rect || !rect.width || !rect.height) { controller.hide(); return; }
      const contact = localHandContact(rect);
      controller.update({ ...contact, width: rect.width }, frame?.phase ?? animation.phase,
        frame?.progress ?? animation.progress ?? 0, frame?.snapshot.isTsumogiri);
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [animation]);
  return null;
}

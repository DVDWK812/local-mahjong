import { useLayoutEffect, useRef } from 'react';
import { presentationEventBus, type WinDeclaredPresentationEvent } from './PresentationEventBus';
import { presentationAudioCues } from './PresentationAudioCue';

/** 17-step has a static winner reveal, not the four-player win animation. */
export function useStaticWinCue(revealCommitted: boolean, session: string): void {
  const committed = useRef(revealCommitted);
  committed.current = revealCommitted;
  const pending = useRef<WinDeclaredPresentationEvent | null>(null);
  const commit = () => {
    if (!committed.current || !pending.current) return;
    const run = presentationAudioCues.run(pending.current);
    pending.current = null;
    run.emit('win-impact', 'winning-hand-reveal-commit', 1);
    run.close();
  };
  useLayoutEffect(() => {
    pending.current = null;
    const unsubscribe = presentationEventBus.subscribe(event => {
      if (event.type !== 'win_declared') return;
      pending.current = event;
      commit();
    });
    return () => { unsubscribe(); pending.current = null; };
  }, [session]);
  useLayoutEffect(commit, [revealCommitted, session]);
}

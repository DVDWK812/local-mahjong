import type { ReplayController } from './types';

export function playbackDelay(speed: ReplayController['speed']): number {
  return 900 / speed;
}

export function advancePlaybackStep(stepIndex: number, totalSteps: number): { stepIndex: number; playing: boolean } {
  const nextStep = Math.min(totalSteps, stepIndex + 1);
  return { stepIndex: nextStep, playing: nextStep < totalSteps };
}

export function scheduleReplayAdvance(
  callback: () => void,
  speed: ReplayController['speed'],
  schedule: typeof setTimeout = setTimeout,
  cancel: typeof clearTimeout = clearTimeout,
): () => void {
  const timer = schedule(callback, playbackDelay(speed));
  return () => cancel(timer);
}

export function shouldHandleReplayShortcut(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return true;
  const element = target as { tagName?: string; isContentEditable?: boolean };
  const tagName = element.tagName?.toLowerCase();
  return !element.isContentEditable && tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select';
}

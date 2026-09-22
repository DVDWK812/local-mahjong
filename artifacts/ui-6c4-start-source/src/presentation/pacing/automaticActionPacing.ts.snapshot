import {
  DEFAULT_PRESENTATION_PACING_TIMEOUT_MS,
  presentationPacingGate,
  type PresentationPacingGate,
  type PresentationPacingWaitStatus,
} from './PresentationPacingGate';

export interface AutomaticActionPacingOptions {
  readonly gate?: Pick<PresentationPacingGate, 'waitUntilClear'>;
  readonly timeoutMs?: number;
  readonly isCancelled?: () => boolean;
}

export interface AutomaticActionPacingResult {
  readonly executed: boolean;
  readonly waitStatus: PresentationPacingWaitStatus;
}

export async function runPacedAutomaticAction(
  action: () => void,
  options: AutomaticActionPacingOptions = {},
): Promise<AutomaticActionPacingResult> {
  const waitStatus = await (options.gate ?? presentationPacingGate).waitUntilClear({
    timeoutMs: options.timeoutMs ?? DEFAULT_PRESENTATION_PACING_TIMEOUT_MS,
  });
  if (options.isCancelled?.()) return { executed: false, waitStatus };
  action();
  return { executed: true, waitStatus };
}

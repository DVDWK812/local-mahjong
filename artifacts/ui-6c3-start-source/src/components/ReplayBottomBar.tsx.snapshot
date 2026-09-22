import type { ReplayController } from '../game/replay/types';
import { ReplayControls } from './ReplayControls';

interface ReplayRoundOption {
  id: string;
  label: string;
  summary: string;
}

interface ReplayBottomBarProps {
  controller: ReplayController;
  totalSteps: number;
  stepIndex: number;
  rounds: ReplayRoundOption[];
  roundIndex: number;
  onRoundChange: (index: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
  onSeekStep: (step: number) => void;
  onSpeedChange: (speed: ReplayController['speed']) => void;
}

export function ReplayBottomBar({
  controller,
  totalSteps,
  stepIndex,
  rounds,
  roundIndex,
  onRoundChange,
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
  onSeekStart,
  onSeekEnd,
  onSeekStep,
  onSpeedChange,
}: ReplayBottomBarProps) {
  const navigation = replayRoundNavigationState(roundIndex, rounds.length);
  return (
    <footer className="replay-bottom-bar">
      <div className="replay-round-controls">
        <div className="replay-round-selector">
          <span className="replay-round-selector__current" aria-hidden="true">{rounds[roundIndex]?.label}</span>
          <select aria-label="选择局数" value={roundIndex} onChange={(event) => onRoundChange(Number(event.target.value))}>
            {rounds.map((round, index) => (
              <option key={round.id} value={index}>{round.label} · {round.summary}</option>
            ))}
          </select>
        </div>
      </div>

      <ReplayControls
        controller={controller}
        eventCount={totalSteps}
        onPlay={onPlay}
        onPause={onPause}
        onStepForward={onStepForward}
        onStepBackward={onStepBackward}
        onSeekStart={onSeekStart}
        onSeekEnd={onSeekEnd}
        onSpeedChange={onSpeedChange}
        canGoPreviousRound={navigation.canGoPrevious}
        canGoNextRound={navigation.canGoNext}
        onPreviousRound={() => onRoundChange(roundIndex - 1)}
        onNextRound={() => onRoundChange(roundIndex + 1)}
      />

      <label className="replay-step-progress">
        <span>步骤进度：{stepIndex} / {totalSteps}</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalSteps)}
          value={stepIndex}
          aria-label="步骤进度"
          onChange={(event) => onSeekStep(Number(event.target.value))}
        />
      </label>
    </footer>
  );
}

export function replayRoundNavigationState(roundIndex: number, roundCount: number) {
  return {
    canGoPrevious: roundIndex > 0,
    canGoNext: roundIndex < roundCount - 1,
  };
}

import type { ReplayController } from '../game/replay/types';

interface ReplayControlsProps {
  controller: ReplayController;
  eventCount: number;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
  onSpeedChange: (speed: ReplayController['speed']) => void;
  canGoPreviousRound?: boolean;
  canGoNextRound?: boolean;
  onPreviousRound?: () => void;
  onNextRound?: () => void;
}

export function ReplayControls({
  controller,
  eventCount,
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
  onSeekStart,
  onSeekEnd,
  onSpeedChange,
  canGoPreviousRound,
  canGoNextRound,
  onPreviousRound,
  onNextRound,
}: ReplayControlsProps) {
  const atStart = controller.currentEventIndex < 0;
  const atEnd = controller.currentEventIndex >= eventCount - 1;
  return (
    <section className="replay-controls">
      <div className="replay-controls__transport">
        <button type="button" onClick={onSeekStart} disabled={atStart}>本局开始</button>
        {onPreviousRound && <button type="button" disabled={!canGoPreviousRound} onClick={onPreviousRound}>上一局</button>}
        <button type="button" onClick={onStepBackward} disabled={atStart}>上一步</button>
        <button type="button" onClick={controller.status === 'playing' ? onPause : onPlay} disabled={eventCount === 0 || (atEnd && controller.status !== 'playing')}>
          {controller.status === 'playing' ? '暂停' : '播放'}
        </button>
        <button type="button" onClick={onStepForward} disabled={atEnd}>下一步</button>
        {onNextRound && <button type="button" disabled={!canGoNextRound} onClick={onNextRound}>下一局</button>}
        <button type="button" onClick={onSeekEnd} disabled={atEnd}>本局结束</button>
      </div>
      <div className="replay-controls__speed">
        <span>播放速度</span>
        <select aria-label="回放速度" value={controller.speed} onChange={(event) => onSpeedChange(Number(event.target.value) as ReplayController['speed'])}>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
        <span className="replay-controls__count">{controller.currentEventIndex + 1} / {eventCount}</span>
      </div>
    </section>
  );
}

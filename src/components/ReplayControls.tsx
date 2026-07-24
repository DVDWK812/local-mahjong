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
}

export function ReplayControls({ controller, eventCount, onPlay, onPause, onStepForward, onStepBackward, onSeekStart, onSeekEnd, onSpeedChange }: ReplayControlsProps) {
  return (
    <section className="replay-controls">
      <button type="button" onClick={controller.status === 'playing' ? onPause : onPlay}>{controller.status === 'playing' ? '暂停' : '播放'}</button>
      <button type="button" onClick={onStepBackward}>上一步</button>
      <button type="button" onClick={onStepForward}>下一步</button>
      <button type="button" onClick={onSeekStart}>开局</button>
      <button type="button" onClick={onSeekEnd}>终局</button>
      <select value={controller.speed} onChange={(event) => onSpeedChange(Number(event.target.value) as ReplayController['speed'])}>
        <option value={0.5}>0.5倍</option>
        <option value={1}>1倍</option>
        <option value={2}>2倍</option>
        <option value={4}>4倍</option>
      </select>
      <span>{controller.currentEventIndex + 1} / {eventCount}</span>
    </section>
  );
}

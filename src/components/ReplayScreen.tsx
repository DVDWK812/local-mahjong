import type { Replay } from '../game/replay/replayEngine';
import { ReplayControls } from './ReplayControls';
import { ReplayEventList } from './ReplayEventList';
import { ReplayInfoPanel } from './ReplayInfoPanel';

interface ReplayScreenProps {
  replay: Replay;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSeek: (index: number) => void;
  onSpeedChange: Parameters<typeof ReplayControls>[0]['onSpeedChange'];
}

export function ReplayScreen({ replay, onPlay, onPause, onStepForward, onStepBackward, onSeek, onSpeedChange }: ReplayScreenProps) {
  return (
    <main className="replay-screen">
      <ReplayControls
        controller={replay.controller}
        eventCount={replay.events.length}
        onPlay={onPlay}
        onPause={onPause}
        onStepForward={onStepForward}
        onStepBackward={onStepBackward}
        onSeekStart={() => onSeek(-1)}
        onSeekEnd={() => onSeek(replay.events.length - 1)}
        onSpeedChange={onSpeedChange}
      />
      <ReplayInfoPanel state={replay.state} debug />
      <ReplayEventList events={replay.events} currentEventIndex={replay.controller.currentEventIndex} onSelect={onSeek} />
    </main>
  );
}

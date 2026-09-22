import type { BuiltReplayState } from '../game/replay/roundReplay';
import type { PlayerId } from '../game/types';
import { ReplayWallPanel } from './ReplayWallPanel';

interface ReplayWallDrawerProps {
  open: boolean;
  replayState: BuiltReplayState;
  allOpen: boolean;
  cameraPlayerId: PlayerId;
  onClose: () => void;
}

export function ReplayWallDrawer({ open, replayState, allOpen, cameraPlayerId, onClose }: ReplayWallDrawerProps) {
  return (
    <>
      <button
        type="button"
        className={`replay-wall-backdrop${open ? ' is-open' : ''}`}
        aria-label="关闭牌山"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        id="replay-wall-drawer"
        className={`replay-wall-drawer${open ? ' is-open' : ''}`}
        aria-label="牌山面板"
        aria-hidden={!open}
      >
        <div className="replay-wall-drawer__header">
          <strong>牌山与王牌</strong>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
        <div className="replay-wall-drawer__body">
          <ReplayWallPanel replayState={replayState} allOpen={allOpen} cameraPlayerId={cameraPlayerId} />
        </div>
      </aside>
    </>
  );
}

import type { PlayerId } from '../game/types';

interface ReplayTopBarProps {
  roundLabel: string;
  stepIndex: number;
  totalSteps: number;
  actionSummary: string;
  playerNames: readonly string[];
  cameraPlayerId: PlayerId;
  isOpenHands: boolean;
  wallOpen: boolean;
  onBack: () => void;
  onPerspectiveChange: (playerId: PlayerId) => void;
  onToggleOpenHands: () => void;
  onToggleWall: () => void;
  testModeEnabled?: boolean;
  testModeConversionReason?: string;
  onConvertToTestScenario?: () => void;
}

export function ReplayTopBar({
  roundLabel,
  stepIndex,
  totalSteps,
  actionSummary,
  playerNames,
  cameraPlayerId,
  isOpenHands,
  wallOpen,
  onBack,
  onPerspectiveChange,
  onToggleOpenHands,
  onToggleWall,
  testModeEnabled = false,
  testModeConversionReason,
  onConvertToTestScenario,
}: ReplayTopBarProps) {
  return (
    <header className="replay-top-bar">
      <div className="replay-top-bar__summary">
        <button type="button" onClick={onBack}>返回牌谱列表</button>
        <strong>当前局：{roundLabel}</strong>
        <span>当前步骤：{stepIndex} / {totalSteps}</span>
        <span className="replay-top-bar__action">当前动作：{actionSummary}</span>
      </div>

      <div className="replay-view-switch" aria-label="观看视角">
        <span>观看视角：</span>
        <div className="replay-view-switch__buttons">
          {playerNames.map((name, player) => (
            <button
              key={`${player}-${name}`}
              type="button"
              className={cameraPlayerId === player ? 'is-active' : ''}
              aria-pressed={cameraPlayerId === player}
              title={name}
              onClick={() => onPerspectiveChange(player as PlayerId)}
            >
              玩家{player + 1}
            </button>
          ))}
        </div>
        <select
          className="replay-view-switch__select"
          aria-label="观看视角"
          value={cameraPlayerId}
          onChange={(event) => onPerspectiveChange(Number(event.target.value) as PlayerId)}
        >
          {playerNames.map((name, player) => <option key={`${player}-${name}`} value={player}>玩家{player + 1} · {name}</option>)}
        </select>
        <button
          type="button"
          className={`replay-open-hands-toggle${isOpenHands ? ' is-active' : ''}`}
          aria-pressed={isOpenHands}
          onClick={onToggleOpenHands}
        >
          全牌公开
        </button>
      </div>

      <div className="replay-top-bar__tools">
        {testModeEnabled ? (
          <>
            <button type="button" disabled={!onConvertToTestScenario} title={testModeConversionReason} onClick={onConvertToTestScenario}>转为测试场景</button>
            {testModeConversionReason ? <span className="replay-test-conversion-reason" role="status">无法转换：{testModeConversionReason}</span> : null}
          </>
        ) : null}
        <button type="button" aria-expanded={wallOpen} aria-controls="replay-wall-drawer" onClick={onToggleWall}>
          牌山
        </button>
      </div>
    </header>
  );
}

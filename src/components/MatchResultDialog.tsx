import type { MatchState } from '../game/match/types';

interface MatchResultDialogProps {
  matchState: MatchState;
  onNewMatch: () => void;
}

export function MatchResultDialog({ matchState, onNewMatch }: MatchResultDialogProps) {
  const result = matchState.finalResult;
  if (!result) return null;
  return (
    <div className="result-backdrop" role="presentation">
      <section className="result-dialog" role="dialog" aria-modal="true" aria-labelledby="match-result-title">
        <div className="result-header">
          <div>
            <h2 id="match-result-title">整场结果</h2>
            <p>同分按起庄顺序优先</p>
          </div>
          <button type="button" onClick={onNewMatch}>新比赛</button>
        </div>
        <div className="match-result-table">
          {result.players.map((player) => (
            <article key={player.player} className="result-card">
              <div className="result-card-title">
                <strong>{player.rank}位 Player {player.player + 1}</strong>
                <span>{player.rawScore.toLocaleString()}点</span>
              </div>
              <p>返点：{player.convertedScore?.toFixed(1)}</p>
              <p>马点：{player.umaAdjustment?.toFixed(1)}</p>
              <p>头跳：{player.okaAdjustment?.toFixed(1)}</p>
              <p>最终比赛分：{player.finalMatchScore?.toFixed(1)}</p>
            </article>
          ))}
        </div>
        <div className="result-card">
          <p>终局原因：{result.endedBy}</p>
          <p>残余供托：{result.leftoverRiichiStickPoints.toLocaleString()}点</p>
          <p>供托归属：{result.leftoverRiichiSticksAwardedTo === undefined ? '未分配' : `Player ${result.leftoverRiichiSticksAwardedTo + 1}`}</p>
        </div>
      </section>
    </div>
  );
}

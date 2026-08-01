import type { MatchState } from '../game/match/types';
import { Dialog, DIALOG_INTERACTION_POLICIES } from './Dialog';

interface MatchResultDialogProps {
  matchState: MatchState;
  onNewMatch: () => void;
}

export function MatchResultDialog({ matchState, onNewMatch }: MatchResultDialogProps) {
  const result = matchState.finalResult;
  if (!result) return null;
  const matchResults = matchState.matchResults.length > 0 ? matchState.matchResults : [result];
  const aggregateRanking = ([0, 1, 2, 3] as const)
    .map((player) => ({ player, score: matchState.aggregateScores[player] }))
    .sort((a, b) => b.score - a.score
      || (a.player - matchState.initialDealer + 4) % 4 - (b.player - matchState.initialDealer + 4) % 4);
  return (
    <Dialog policy={DIALOG_INTERACTION_POLICIES.matchResult} labelledBy="match-result-title" describedBy="match-result-description" testId="match-result-dialog">
        <div className="result-header">
          <div>
            <h2 id="match-result-title">整场比赛总结</h2>
            <p id="match-result-description">共完成{matchResults.length}场；总分同分时按起庄顺序优先</p>
          </div>
          <button type="button" onClick={onNewMatch} data-dialog-initial-focus="true">新比赛</button>
        </div>
        <h3>总排名</h3>
        <div className="match-result-table">
          {aggregateRanking.map((player, index) => (
            <article key={player.player} className="result-card">
              <div className="result-card-title">
                <strong>{index + 1}位 Player {player.player + 1}</strong>
                <span>{player.score.toFixed(1)}</span>
              </div>
              <p>累计比赛分：{player.score.toFixed(1)}</p>
            </article>
          ))}
        </div>
        <h3>各场结果</h3>
        {matchResults.map((matchResult, matchIndex) => (
          <section key={matchIndex} className="result-card">
            <h4>第{matchIndex + 1}场</h4>
            <div className="match-result-table">
              {matchResult.players.map((player) => (
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
            <p>终局原因：{matchResult.endedBy}</p>
            <p>残余供托：{matchResult.leftoverRiichiStickPoints.toLocaleString()}点</p>
            <p>供托归属：{matchResult.leftoverRiichiSticksAwardedTo === undefined ? '未分配' : `Player ${matchResult.leftoverRiichiSticksAwardedTo + 1}`}</p>
          </section>
        ))}
    </Dialog>
  );
}

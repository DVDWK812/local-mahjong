import type { MatchState } from '../game/match/types';

interface ScoreHistoryProps {
  matchState: MatchState;
}

export function ScoreHistory({ matchState }: ScoreHistoryProps) {
  if (matchState.scoreHistory.length === 0) return null;
  return (
    <section className="score-history">
      <h3>局历史</h3>
      {matchState.scoreHistory.slice(-4).map((entry, index) => (
        <div key={`${entry.roundLabel}-${index}`} className="score-history-row">
          <span>{entry.roundLabel}</span>
          <span>{entry.scores.map((score) => score.toLocaleString()).join(' / ')}</span>
        </div>
      ))}
    </section>
  );
}

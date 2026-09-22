import type { MatchState } from '../game/match/types';
import { roundLabel } from '../game/match/roundTransition';

interface RoundInfoProps {
  matchState: MatchState;
}

export function RoundInfo({ matchState }: RoundInfoProps) {
  return (
    <div className="round-info">
      <span>{roundLabel(matchState)}</span>
      <span>{matchState.honba}本场</span>
      <span>供托 {matchState.riichiSticks}</span>
    </div>
  );
}

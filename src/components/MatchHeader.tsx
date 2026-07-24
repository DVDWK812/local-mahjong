import { roundLabel } from '../game/match/roundTransition';
import type { MatchState } from '../game/match/types';
import { windLabel } from '../game/tileUtils';

interface MatchHeaderProps {
  matchState: MatchState;
}

export function MatchHeader({ matchState }: MatchHeaderProps) {
  const isExtra = matchState.matchLength === 'east-only'
    ? matchState.roundWind !== 'east'
    : matchState.roundWind !== 'east' && matchState.roundWind !== 'south';
  const dealer = matchState.currentGame?.players[matchState.dealer];

  return (
    <section className="match-header" aria-label="比赛信息">
      <strong>{roundLabel(matchState)} {matchState.honba}本场 供托{matchState.riichiSticks}</strong>
      <span>{matchState.matchLength === 'east-only' ? '东风场' : '南风场'}{isExtra ? ' · 延长局' : ''}</span>
      <span>当前庄家：{dealer ? `${windLabel(dealer.seatWind)}家 ${dealer.name}` : `Player ${matchState.dealer + 1}`}</span>
    </section>
  );
}

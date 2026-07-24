import type { MatchState } from '../../game/match/types';
import type { GameState, PlayerId, Wind } from '../../game/types';

interface TableCenterProps {
  gameState: GameState;
  matchState?: MatchState;
}

const scorePositions: Array<{ playerId: PlayerId; className: string }> = [
  { playerId: 2, className: 'center-score--north' },
  { playerId: 3, className: 'center-score--west' },
  { playerId: 1, className: 'center-score--east' },
  { playerId: 0, className: 'center-score--south' },
];

const windNames: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

function roundText(gameState: GameState, matchState?: MatchState): string {
  const wind = matchState?.roundWind ?? gameState.roundWind;
  const handNumber = matchState?.handNumber ?? 1;
  return `${windNames[wind]}${handNumber}局`;
}

function SeatWindLabel({ isDealer, wind }: { isDealer: boolean; wind: Wind }) {
  if (!isDealer) return <span>{windNames[wind]}</span>;
  return (
    <span className="center-seat-wind">
      <span className="dealer-marker">庄</span>
      <span>{windNames[wind]}</span>
    </span>
  );
}

export function TableCenter({ gameState, matchState }: TableCenterProps) {
  return (
    <section className="table-center" aria-label="中央计分区">
      <div className="center-score-grid">
        {scorePositions.map(({ playerId, className }) => {
          const player = gameState.players[playerId];
          return (
            <div
              key={playerId}
              className={`center-score ${className} ${gameState.currentPlayer === playerId ? 'center-score--current' : ''} ${gameState.dealer === playerId ? 'center-score--dealer' : ''}`}
              data-center-player={playerId}
            >
              <SeatWindLabel isDealer={gameState.dealer === playerId} wind={player.seatWind} />
              <strong>{player.score.toLocaleString()}</strong>
            </div>
          );
        })}
        <div className="center-round">
          <strong>{roundText(gameState, matchState)}</strong>
          <span>{gameState.honba}本场</span>
          <span>剩余{gameState.wall.length}张</span>
        </div>
      </div>
    </section>
  );
}

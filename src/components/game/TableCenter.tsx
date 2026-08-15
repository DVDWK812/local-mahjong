import type { MatchState } from '../../game/match/types';
import type { GameState, PlayerId, Wind } from '../../game/types';
import type { TableSeatMapping } from './MahjongTable';

interface TableCenterProps {
  gameState: GameState;
  matchState?: Pick<MatchState, 'roundWind' | 'handNumber'>;
  seatMapping?: TableSeatMapping;
  activePlayerIds?: PlayerId[];
  roundLabel?: string;
  remainingLabel?: string | null;
  centerCornerLabels?: {
    topLeft?: string;
    bottomRight?: string;
  };
}

const windNames: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

function roundText(gameState: GameState, matchState?: Pick<MatchState, 'roundWind' | 'handNumber'>, roundLabel?: string): string {
  if (roundLabel) return roundLabel;
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

export function TableCenter({ gameState, matchState, seatMapping = {
  bottomPlayerId: 0,
  rightPlayerId: 1,
  topPlayerId: 2,
  leftPlayerId: 3,
}, activePlayerIds, roundLabel, remainingLabel, centerCornerLabels }: TableCenterProps) {
  const scorePositions: Array<{ playerId: PlayerId; className: string; slot: 'top' | 'left' | 'right' | 'bottom' }> = [
    { playerId: seatMapping.topPlayerId, className: 'center-score--north', slot: 'top' as const },
    { playerId: seatMapping.leftPlayerId, className: 'center-score--west', slot: 'left' as const },
    { playerId: seatMapping.rightPlayerId, className: 'center-score--east', slot: 'right' as const },
    { playerId: seatMapping.bottomPlayerId, className: 'center-score--south', slot: 'bottom' as const },
  ].filter(({ playerId }) => !activePlayerIds || activePlayerIds.includes(playerId));
  return (
    <section className="table-center" aria-label="中央计分区">
      {centerCornerLabels?.topLeft ? <span className="table-center-corner table-center-corner--top-left">{centerCornerLabels.topLeft}</span> : null}
      {centerCornerLabels?.bottomRight ? <span className="table-center-corner table-center-corner--bottom-right">{centerCornerLabels.bottomRight}</span> : null}
      <div className="center-score-grid">
        {scorePositions.map(({ playerId, className, slot }) => {
          const player = gameState.players[playerId];
          return (
            <div
              key={slot}
              className={`center-score ${className} ${gameState.currentPlayer === playerId ? 'center-score--current' : ''} ${gameState.dealer === playerId ? 'center-score--dealer' : ''}`}
              data-center-slot={slot}
              data-center-player={playerId}
            >
              <SeatWindLabel isDealer={gameState.dealer === playerId} wind={player.seatWind} />
              <strong>{player.score.toLocaleString()}</strong>
            </div>
          );
        })}
        <div className="center-round">
          <strong>{roundText(gameState, matchState, roundLabel)}</strong>
          <span>{gameState.honba}本场</span>
          {remainingLabel === null ? null : <span>{remainingLabel ?? `剩余${gameState.wall.length}张`}</span>}
        </div>
      </div>
    </section>
  );
}

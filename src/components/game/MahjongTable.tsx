import type { MatchState } from '../../game/match/types';
import type { GameState, PlayerId } from '../../game/types';
import { DiscardRiver } from './DiscardRiver';
import { DoraIndicatorStack } from './DoraIndicatorStack';
import { PlayerZone, type PlayerPosition } from './PlayerZone';
import { RiichiStick } from './RiichiStick';
import { TableCenter } from './TableCenter';

interface MahjongTableProps {
  gameState: GameState;
  matchState?: MatchState;
}

const positions: Array<{ playerId: PlayerId; position: PlayerPosition; showHand?: boolean }> = [
  { playerId: 2, position: 'north' },
  { playerId: 3, position: 'west' },
  { playerId: 1, position: 'east' },
  { playerId: 0, position: 'south', showHand: false },
];

const riverPositions: Array<{ playerId: PlayerId; position: PlayerPosition; area: string; stickArea: string; stickOrientation: 'horizontal' | 'vertical' }> = [
  { playerId: 2, position: 'north', area: 'north-river', stickArea: 'north-stick', stickOrientation: 'horizontal' },
  { playerId: 3, position: 'west', area: 'west-river', stickArea: 'west-stick', stickOrientation: 'vertical' },
  { playerId: 1, position: 'east', area: 'east-river', stickArea: 'east-stick', stickOrientation: 'vertical' },
  { playerId: 0, position: 'south', area: 'south-river', stickArea: 'south-stick', stickOrientation: 'horizontal' },
];

export function MahjongTable({ gameState, matchState }: MahjongTableProps) {
  return (
    <section className="mahjong-table" aria-label="麻将牌桌">
      <DoraIndicatorStack gameState={gameState} matchState={matchState} />
      {positions.map(({ playerId, position, showHand }) => {
        const player = gameState.players[playerId];
        return (
          <PlayerZone
            key={playerId}
            playerIndex={playerId}
            position={position}
            player={player}
            score={player.score}
            seatWind={player.seatWind}
            isDealer={gameState.dealer === playerId}
            isCurrentPlayer={gameState.currentPlayer === playerId}
            showHand={showHand}
            showRiver={false}
          />
        );
      })}
      <div className="table-center-cluster" aria-label="中央牌河区">
        {riverPositions.map(({ playerId, position, area }) => (
          <div key={`${position}-river`} className={`table-river-anchor table-river-anchor--${position}`} style={{ gridArea: area }}>
            <DiscardRiver player={gameState.players[playerId]} position={position} />
          </div>
        ))}
        {riverPositions.map(({ playerId, position, stickArea, stickOrientation }) => (
          <div key={`${position}-stick`} className={`table-riichi-anchor table-riichi-anchor--${position}`} style={{ gridArea: stickArea }}>
            <RiichiStick orientation={stickOrientation} active={gameState.players[playerId].riichi} />
          </div>
        ))}
        <TableCenter gameState={gameState} matchState={matchState} />
      </div>
    </section>
  );
}

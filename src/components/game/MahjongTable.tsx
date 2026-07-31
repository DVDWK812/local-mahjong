import type { MatchState } from '../../game/match/types';
import type { GameState, PlayerId, TileId } from '../../game/types';
import { DiscardRiver } from './DiscardRiver';
import { DoraIndicatorStack } from './DoraIndicatorStack';
import { PlayerZone, type PlayerPosition } from './PlayerZone';
import { RiichiStick } from './RiichiStick';
import { TableCenter } from './TableCenter';
import { PlayerMelds } from '../PlayerMelds';

interface MahjongTableProps {
  gameState: GameState;
  matchState?: Pick<MatchState, 'roundWind' | 'handNumber'>;
  doraGlowEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  tsumoGiriDisplayEnabled?: boolean;
  bottomPlayerId?: PlayerId;
  seatMapping?: TableSeatMapping;
  revealOpponentHands?: boolean;
  revealedPlayerId?: PlayerId;
}

export interface TableSeatMapping {
  bottomPlayerId: PlayerId;
  rightPlayerId: PlayerId;
  topPlayerId: PlayerId;
  leftPlayerId: PlayerId;
}

export function MahjongTable({ gameState, matchState, doraGlowEnabled = true, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange, tsumoGiriDisplayEnabled = true, bottomPlayerId = 0, seatMapping, revealOpponentHands = false, revealedPlayerId }: MahjongTableProps) {
  const preserveClaimedDiscardGap = gameState.ruleConfig?.preserveClaimedDiscardGap ?? false;
  const mapping = seatMapping ?? getTableSeatMapping(bottomPlayerId);
  const seats = {
    south: mapping.bottomPlayerId,
    east: mapping.rightPlayerId,
    north: mapping.topPlayerId,
    west: mapping.leftPlayerId,
  } as const;
  const positions: Array<{ playerId: PlayerId; position: PlayerPosition; showHand?: boolean }> = [
    { playerId: seats.north, position: 'north' },
    { playerId: seats.east, position: 'east' },
    { playerId: seats.south, position: 'south', showHand: false },
    { playerId: seats.west, position: 'west' },
  ];
  const riverPositions: Array<{ playerId: PlayerId; position: PlayerPosition; area: string; stickArea: string; stickOrientation: 'horizontal' | 'vertical' }> = [
    { playerId: seats.north, position: 'north', area: 'north-river', stickArea: 'north-stick', stickOrientation: 'horizontal' },
    { playerId: seats.east, position: 'east', area: 'east-river', stickArea: 'east-stick', stickOrientation: 'vertical' },
    { playerId: seats.south, position: 'south', area: 'south-river', stickArea: 'south-stick', stickOrientation: 'horizontal' },
    { playerId: seats.west, position: 'west', area: 'west-river', stickArea: 'west-stick', stickOrientation: 'vertical' },
  ];
  const slotNames: Record<PlayerPosition, 'top' | 'right' | 'bottom' | 'left'> = {
    north: 'top',
    east: 'right',
    south: 'bottom',
    west: 'left',
  };
  const meldPositions: Array<{ playerId: PlayerId; position: Exclude<PlayerPosition, 'south'> }> = [
    { playerId: seats.north, position: 'north' },
    { playerId: seats.east, position: 'east' },
    { playerId: seats.west, position: 'west' },
  ];

  return (
    <section className="mahjong-table" aria-label="麻将牌桌">
      <DoraIndicatorStack gameState={gameState} matchState={matchState} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
      {positions.map(({ playerId, position, showHand }) => {
        const player = gameState.players[playerId];
        return (
          <PlayerZone
            key={position}
            playerIndex={playerId}
            position={position}
            player={player}
            score={player.score}
            seatWind={player.seatWind}
            isDealer={gameState.dealer === playerId}
            isCurrentPlayer={gameState.currentPlayer === playerId}
            showHand={showHand}
            concealHand={!revealOpponentHands && revealedPlayerId !== playerId}
            showRiver={false}
            showMelds={false}
            doraIndicators={gameState.doraIndicators}
            doraGlowEnabled={doraGlowEnabled}
            hoveredTileType={hoveredTileType}
            sameTileHoverEnabled={sameTileHoverEnabled}
            onHoveredTileTypeChange={onHoveredTileTypeChange}
            tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled}
          />
        );
      })}
      {meldPositions.map(({ playerId, position }) => (
        <div
          key={`${position}-melds`}
          className={`meld-slot meld-slot--${slotNames[position]} table-meld-anchor table-meld-anchor--${position}`}
          data-table-meld-zone={position}
          data-meld-player={playerId}
          aria-label={`${gameState.players[playerId].name} 鸣牌区`}
        >
          <div className={`table-meld-rotator table-meld-rotator--${position}`}>
            <PlayerMelds player={gameState.players[playerId]} seatClass={`seat-${position} table-melds-${position}`} doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
          </div>
        </div>
      ))}
      <div className="table-center-cluster" aria-label="中央牌河区">
        {riverPositions.map(({ playerId, position, area }) => (
          <div key={`${position}-river`} className={`river-slot river-slot--${slotNames[position]} table-river-anchor table-river-anchor--${position}`} data-river-player={playerId} style={{ gridArea: area }}>
            <DiscardRiver player={gameState.players[playerId]} position={position} preserveClaimedDiscardGap={preserveClaimedDiscardGap} doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
          </div>
        ))}
        {riverPositions.map(({ playerId, position, stickArea, stickOrientation }) => (
          <div key={`${position}-stick`} className={`table-riichi-anchor table-riichi-anchor--${position}`} style={{ gridArea: stickArea }}>
            <RiichiStick orientation={stickOrientation} active={gameState.players[playerId].riichi} />
          </div>
        ))}
        <TableCenter gameState={gameState} matchState={matchState} seatMapping={mapping} />
      </div>
    </section>
  );
}

export function playersByPosition(bottomPlayerId: PlayerId): Record<PlayerPosition, PlayerId> {
  const mapping = getTableSeatMapping(bottomPlayerId);
  return {
    south: mapping.bottomPlayerId,
    east: mapping.rightPlayerId,
    north: mapping.topPlayerId,
    west: mapping.leftPlayerId,
  };
}

function getTableSeatMapping(bottomPlayerId: PlayerId): TableSeatMapping {
  return {
    bottomPlayerId,
    rightPlayerId: ((bottomPlayerId + 1) % 4) as PlayerId,
    topPlayerId: ((bottomPlayerId + 2) % 4) as PlayerId,
    leftPlayerId: ((bottomPlayerId + 3) % 4) as PlayerId,
  };
}

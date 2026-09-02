import type { MatchState } from '../../game/match/types';
import type { GameState, PlayerId, TileId } from '../../game/types';
import type { DoraIndicatorSlot } from '../../presentation/table/TablePresentationContract';
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
  activeSeats?: PlayerPosition[];
  centerRoundLabel?: string;
  centerRemainingLabel?: string | null;
  centerCornerLabels?: {
    topLeft?: string;
    bottomRight?: string;
  };
  riverColumns?: number;
  doraIndicatorSlots?: readonly DoraIndicatorSlot[];
}

export interface TableSeatMapping {
  bottomPlayerId: PlayerId;
  rightPlayerId: PlayerId;
  topPlayerId: PlayerId;
  leftPlayerId: PlayerId;
}

export function MahjongTable({ gameState, matchState, doraGlowEnabled = true, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange, tsumoGiriDisplayEnabled = true, bottomPlayerId = 0, seatMapping, revealOpponentHands = false, revealedPlayerId, activeSeats, centerRoundLabel, centerRemainingLabel, centerCornerLabels, riverColumns, doraIndicatorSlots }: MahjongTableProps) {
  const preserveClaimedDiscardGap = gameState.ruleConfig?.preserveClaimedDiscardGap ?? false;
  const mapping = seatMapping ?? getTableSeatMapping(bottomPlayerId);
  const seats = {
    south: mapping.bottomPlayerId,
    east: mapping.rightPlayerId,
    north: mapping.topPlayerId,
    west: mapping.leftPlayerId,
  } as const;
  const positions: Array<{ playerId: PlayerId; position: PlayerPosition; showHand?: boolean }> = [
    { playerId: seats.north, position: 'north' as const },
    { playerId: seats.east, position: 'east' as const },
    { playerId: seats.south, position: 'south' as const, showHand: false },
    { playerId: seats.west, position: 'west' as const },
  ].filter(({ position }) => !activeSeats || activeSeats.includes(position));
  const riverPositions: Array<{ playerId: PlayerId; position: PlayerPosition; area: string; stickArea: string; stickOrientation: 'horizontal' | 'vertical' }> = [
    { playerId: seats.north, position: 'north' as const, area: 'north-river', stickArea: 'north-stick', stickOrientation: 'horizontal' as const },
    { playerId: seats.east, position: 'east' as const, area: 'east-river', stickArea: 'east-stick', stickOrientation: 'vertical' as const },
    { playerId: seats.south, position: 'south' as const, area: 'south-river', stickArea: 'south-stick', stickOrientation: 'horizontal' as const },
    { playerId: seats.west, position: 'west' as const, area: 'west-river', stickArea: 'west-stick', stickOrientation: 'vertical' as const },
  ].filter(({ position }) => !activeSeats || activeSeats.includes(position));
  const slotNames: Record<PlayerPosition, 'top' | 'right' | 'bottom' | 'left'> = {
    north: 'top',
    east: 'right',
    south: 'bottom',
    west: 'left',
  };
  const meldPositions: Array<{ playerId: PlayerId; position: Exclude<PlayerPosition, 'south'> }> = [
    { playerId: seats.north, position: 'north' as const },
    { playerId: seats.east, position: 'east' as const },
    { playerId: seats.west, position: 'west' as const },
  ].filter(({ position }) => !activeSeats || activeSeats.includes(position));

  return (
    <section className="mahjong-table" aria-label="麻将牌桌">
      <DoraIndicatorStack gameState={gameState} matchState={matchState} slots={doraIndicatorSlots} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
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
            <DiscardRiver player={gameState.players[playerId]} position={position} preserveClaimedDiscardGap={preserveClaimedDiscardGap} doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} columns={riverColumns} />
          </div>
        ))}
        {riverPositions.map(({ playerId, position, stickArea, stickOrientation }) => (
          <div
            key={`${position}-stick`}
            className={`table-riichi-anchor table-riichi-anchor--${position}`}
            data-riichi-player={playerId}
            data-riichi-position={position}
            style={{ gridArea: stickArea }}
          >
            <RiichiStick orientation={stickOrientation} active={gameState.players[playerId].riichi} />
          </div>
        ))}
        <TableCenter gameState={gameState} matchState={matchState} seatMapping={mapping} activePlayerIds={activeSeats ? activeSeats.map((position) => seats[position]) : undefined} roundLabel={centerRoundLabel} remainingLabel={centerRemainingLabel} centerCornerLabels={centerCornerLabels} />
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

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
  matchState?: MatchState;
  doraGlowEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  tsumoGiriDisplayEnabled?: boolean;
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

const meldPositions: Array<{ playerId: PlayerId; position: Exclude<PlayerPosition, 'south'> }> = [
  { playerId: 2, position: 'north' },
  { playerId: 1, position: 'east' },
  { playerId: 3, position: 'west' },
];

export function MahjongTable({ gameState, matchState, doraGlowEnabled = true, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange, tsumoGiriDisplayEnabled = true }: MahjongTableProps) {
  const preserveClaimedDiscardGap = gameState.ruleConfig?.preserveClaimedDiscardGap ?? false;

  return (
    <section className="mahjong-table" aria-label="麻将牌桌">
      <DoraIndicatorStack gameState={gameState} matchState={matchState} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
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
          className={`table-meld-anchor table-meld-anchor--${position}`}
          data-table-meld-zone={position}
          aria-label={`${gameState.players[playerId].name} 鸣牌区`}
        >
          <div className={`table-meld-rotator table-meld-rotator--${position}`}>
            <PlayerMelds player={gameState.players[playerId]} seatClass={`seat-${playerId} table-melds-${position}`} doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
          </div>
        </div>
      ))}
      <div className="table-center-cluster" aria-label="中央牌河区">
        {riverPositions.map(({ playerId, position, area }) => (
          <div key={`${position}-river`} className={`table-river-anchor table-river-anchor--${position}`} style={{ gridArea: area }}>
            <DiscardRiver player={gameState.players[playerId]} position={position} preserveClaimedDiscardGap={preserveClaimedDiscardGap} doraIndicators={gameState.doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
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

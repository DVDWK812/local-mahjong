import type { PlayerId, PlayerState, Tile as TileModel, TileId, Wind } from '../../game/types';
import { PlayerMelds } from '../PlayerMelds';
import { DiscardRiver } from './DiscardRiver';
import { HandTrack } from './HandTrack';

export type PlayerPosition = 'south' | 'east' | 'north' | 'west';

interface PlayerZoneProps {
  playerIndex: PlayerId;
  position: PlayerPosition;
  player: PlayerState;
  score: number;
  seatWind: Wind;
  isDealer: boolean;
  isCurrentPlayer: boolean;
  showHand?: boolean;
  concealHand?: boolean;
  showRiver?: boolean;
  showMelds?: boolean;
  doraIndicators?: TileModel[];
  doraGlowEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  tsumoGiriDisplayEnabled?: boolean;
}

const windNames: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

const slotNames: Record<PlayerPosition, 'bottom' | 'right' | 'top' | 'left'> = {
  south: 'bottom',
  east: 'right',
  north: 'top',
  west: 'left',
};

export function PlayerZone({
  playerIndex,
  position,
  player,
  score,
  seatWind,
  isDealer,
  isCurrentPlayer,
  showHand = true,
  concealHand,
  showRiver = true,
  showMelds = true,
  doraIndicators = [],
  doraGlowEnabled = true,
  hoveredTileType = null,
  sameTileHoverEnabled = true,
  onHoveredTileTypeChange,
  tsumoGiriDisplayEnabled = true,
}: PlayerZoneProps) {
  const showOpponentHand = showHand;
  void score;

  return (
    <section
      className={`player-slot player-slot--${slotNames[position]} player-zone player-zone--${position} ${showOpponentHand ? '' : 'player-zone--river-only'} ${showRiver ? '' : 'player-zone--no-river'} ${isCurrentPlayer ? 'player-zone--current' : ''}`}
      data-player-slot={slotNames[position]}
      data-player-zone={position}
      data-player-index={playerIndex}
      aria-label={`${player.name} 区域`}
    >
      <div className="player-zone-layout">
        {showOpponentHand ? (
          <div className={`player-zone-hand-wrap hand-slot hand-slot--${slotNames[position]}`} data-hand-slot={slotNames[position]}>
            <HandTrack player={player} position={position} concealed={concealHand} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
          </div>
        ) : null}

        {showOpponentHand ? (
          <PlayerIdentity player={player} seatWind={seatWind} isDealer={isDealer} tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled} />
        ) : null}

        {showRiver ? (
          <div className="player-zone-river-wrap">
            <DiscardRiver player={player} position={position} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
          </div>
        ) : null}

        {showOpponentHand && showMelds ? (
          <div className={`player-zone-meld-wrap meld-slot meld-slot--${slotNames[position]}`} data-ai-meld-zone={player.id === 0 ? undefined : position}>
            <div className={`player-zone-meld-rotator player-zone-meld-rotator--${position}`}>
              <PlayerMelds player={player} seatClass={`seat-${slotNames[position]} melds-${position}`} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PlayerIdentity({ player, seatWind, isDealer, tsumoGiriDisplayEnabled }: { player: PlayerState; seatWind: Wind; isDealer: boolean; tsumoGiriDisplayEnabled: boolean }) {
  const initial = player.name.trim().slice(0, 1) || windNames[seatWind];
  return (
    <div className="player-identity player-zone-label">
      <span className="player-avatar" aria-hidden="true">{initial}</span>
      {tsumoGiriDisplayEnabled ? <TsumogiriMarker player={player} /> : null}
      <strong title={player.name}>{player.name}</strong>
      <span className="player-badges">
        {isDealer ? <em className="dealer-marker">庄</em> : null}
        {player.riichi ? <em>立直</em> : null}
      </span>
    </div>
  );
}

function TsumogiriMarker({ player }: { player: PlayerState }) {
  const lastDiscard = player.river[player.river.length - 1];
  const isTsumogiri = lastDiscard?.isTsumogiri === true;
  return (
    <span className={`tsumogiri-marker ${isTsumogiri ? 'tsumogiri-marker--drawn' : 'tsumogiri-marker--blocked'}`} title={isTsumogiri ? '摸切' : '非摸切'}>
      切
    </span>
  );
}

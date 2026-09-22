import type { PlayerState, Tile as TileModel, TileId } from '../../game/types';
import { Tile } from '../Tile';
import type { PlayerPosition } from './PlayerZone';

interface HandTrackProps {
  player: PlayerState;
  position: PlayerPosition;
  concealed?: boolean;
  doraIndicators?: TileModel[];
  doraGlowEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
}

export function HandTrack({ player, position, concealed = position !== 'south', doraIndicators = [], doraGlowEnabled = true, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange }: HandTrackProps) {
  const drawnTileId = player.drawnTile?.instanceId;
  const baseTiles = drawnTileId ? player.hand.filter((tile) => tile.instanceId !== drawnTileId) : player.hand;
  const drawnTile = drawnTileId ? player.hand.find((tile) => tile.instanceId === drawnTileId) : null;
  const isSide = position === 'west' || position === 'east';

  return (
    <div className={`hand-track-wrapper ${isSide ? `side-player-hand-wrapper side-player-hand-wrapper--${position}` : ''}`}>
      <div className="hand-track opponent-hand-track" aria-label={`${player.name} 手牌`}>
        {baseTiles.map((tile) => (
          <Tile key={tile.instanceId} tile={concealed ? undefined : tile} faceDown={concealed} compact={position !== 'south'} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
        ))}
        {drawnTile ? (
          <span className="opponent-drawn-gap">
            <Tile tile={concealed ? undefined : drawnTile} faceDown={concealed} compact={position !== 'south'} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

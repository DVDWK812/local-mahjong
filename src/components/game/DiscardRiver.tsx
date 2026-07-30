import type { PlayerState, Tile as TileModel, TileId } from '../../game/types';
import { Tile } from '../Tile';

interface DiscardRiverProps {
  player: PlayerState;
  position: 'south' | 'east' | 'north' | 'west';
  preserveClaimedDiscardGap?: boolean;
  doraIndicators?: TileModel[];
  doraGlowEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
}

function isClaimedDiscard(tile: PlayerState['river'][number]): boolean {
  const marker = tile as PlayerState['river'][number] & { claimed?: boolean; claimedBy?: number | null };
  return marker.claimed === true || marker.claimedBy !== undefined;
}

export function DiscardRiver({ player, position, preserveClaimedDiscardGap = false, doraIndicators = [], doraGlowEnabled = true, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange }: DiscardRiverProps) {
  const riichiDiscardInstanceId = player.riichiState?.riichiDiscardInstanceId;

  return (
    <div className={`discard-river discard-river--${position}`} aria-label={`${player.name} 牌河`} data-position={position}>
      <div className="discard-river-grid">
        {player.river.map((tile) => {
          const isRiichiDiscard = tile.isRiichiDiscard === true || riichiDiscardInstanceId === tile.instanceId;
          const isClaimed = isClaimedDiscard(tile);
          if (isClaimed && !preserveClaimedDiscardGap) return null;
          const className = [
            'discard-river-tile',
            isRiichiDiscard ? 'discard-river-tile--riichi riichi-discard-slot' : '',
            isClaimed ? 'discard-river-tile--claimed' : '',
          ].filter(Boolean).join(' ');

          return (
            <span key={tile.instanceId} className={className}>
              {isClaimed ? <span className="discard-river-claimed-placeholder" aria-hidden="true" /> : <Tile tile={tile} compact interactive={false} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

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
  columns?: number;
}

function isClaimedDiscard(tile: PlayerState['river'][number]): boolean {
  const marker = tile as PlayerState['river'][number] & { claimed?: boolean; claimedBy?: number | null };
  return marker.claimed === true || marker.claimedBy !== undefined;
}

export function DiscardRiver({ player, position, preserveClaimedDiscardGap = false, doraIndicators = [], doraGlowEnabled = true, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange, columns = 6 }: DiscardRiverProps) {
  const riichiDiscardInstanceId = player.riichiState?.riichiDiscardInstanceId;
  const visibleRiver = preserveClaimedDiscardGap
    ? player.river
    : player.river.filter((tile) => !isClaimedDiscard(tile));
  const isHorizontalRiver = position === 'south' || position === 'north';
  const riverRows = [visibleRiver.slice(0, columns), visibleRiver.slice(columns, columns * 2), visibleRiver.slice(columns * 2)]
    .filter((row) => row.length > 0);

  return (
    <div className={`discard-river discard-river--${position}`} aria-label={`${player.name} 牌河`} data-position={position}>
      <div className="discard-river-grid">
        {riverRows.map((tiles, rowIndex) => (
          <div className="discard-river-row" data-river-line={rowIndex + 1} key={rowIndex}>
            {tiles.map((tile, columnIndex) => {
              const riverIndex = player.river.findIndex((candidate) => candidate.instanceId === tile.instanceId);
              const isRiichiDiscard = tile.isRiichiDiscard === true || riichiDiscardInstanceId === tile.instanceId;
              const isClaimed = isClaimedDiscard(tile);
              const className = [
                'discard-river-tile',
                isRiichiDiscard ? 'discard-river-tile--riichi' : '',
                isClaimed ? 'discard-river-tile--claimed' : '',
              ].filter(Boolean).join(' ');

              return (
                <span
                  key={tile.instanceId}
                  className={className}
                  data-river-row={isHorizontalRiver ? rowIndex + 1 : undefined}
                  data-river-column={isHorizontalRiver ? columnIndex + 1 : undefined}
                  data-river-index={riverIndex}
                >
                  {isClaimed ? (
                    isRiichiDiscard ? (
                      <span className="riichi-discard-slot">
                        <span className="discard-river-claimed-placeholder" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="discard-river-claimed-placeholder" aria-hidden="true" />
                    )
                  ) : isRiichiDiscard ? (
                    <span className="riichi-discard-slot">
                      <Tile tile={tile} compact interactive={false} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
                    </span>
                  ) : (
                    <Tile tile={tile} compact interactive={false} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

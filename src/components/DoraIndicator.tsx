import type { Tile as TileModel, TileId } from '../game/types';
import { Tile } from './Tile';

interface DoraIndicatorProps {
  indicators: TileModel[];
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
}

export function DoraIndicator({ indicators, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange }: DoraIndicatorProps) {
  return (
    <section className="dora-panel">
      <div className="panel-title">
        <strong>宝牌指示牌</strong>
        <span>{indicators.length} 枚</span>
      </div>
      <div className="dora-row">
        {indicators.map((tile) => (
          <Tile key={tile.instanceId} tile={tile} doraGlowEnabled={false} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
        ))}
      </div>
    </section>
  );
}

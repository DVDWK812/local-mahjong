import type { Tile as TileModel } from '../game/types';
import { Tile } from './Tile';

interface DoraIndicatorProps {
  indicators: TileModel[];
}

export function DoraIndicator({ indicators }: DoraIndicatorProps) {
  return (
    <section className="dora-panel">
      <div className="panel-title">
        <strong>宝牌指示牌</strong>
        <span>{indicators.length} 枚</span>
      </div>
      <div className="dora-row">
        {indicators.map((tile) => (
          <Tile key={tile.instanceId} tile={tile} />
        ))}
      </div>
    </section>
  );
}

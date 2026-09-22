import type { GameState } from '../game/types';
import { getVisibleTileCounts } from '../game/visibility';
import { Tile } from './Tile';

interface TileCounterProps {
  gameState: GameState;
}

export function TileCounter({ gameState }: TileCounterProps) {
  const counts = getVisibleTileCounts(gameState);

  return (
    <section className="counter-panel">
      <div className="panel-title">
        <strong>牌数统计</strong>
        <span>剩余</span>
      </div>
      <div className="counter-grid">
        {counts.map((count) => (
          <div key={count.id} className="counter-cell">
            <Tile id={count.id} compact />
            <em>{count.remaining}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

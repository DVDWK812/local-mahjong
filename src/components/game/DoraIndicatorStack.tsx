import type { MatchState } from '../../game/match/types';
import type { GameState, TileId, Wind } from '../../game/types';
import { Tile } from '../Tile';

interface DoraIndicatorStackProps {
  gameState: Pick<GameState, 'doraIndicators' | 'honba' | 'riichiSticks' | 'roundWind'>;
  matchState?: Pick<MatchState, 'roundWind' | 'handNumber'>;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
}

const SLOT_COUNT = 5;

const windNames: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

function roundText(gameState: DoraIndicatorStackProps['gameState'], matchState?: DoraIndicatorStackProps['matchState']): string {
  const wind = matchState?.roundWind ?? gameState.roundWind;
  const handNumber = matchState?.handNumber ?? 1;
  return `${windNames[wind]}${handNumber}局`;
}

export function DoraIndicatorStack({ gameState, matchState, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange }: DoraIndicatorStackProps) {
  const indicators = gameState.doraIndicators.slice(0, SLOT_COUNT);
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) => indicators[index] ?? null);

  return (
    <aside className="dora-indicator-stack" aria-label="宝牌指示牌">
      <span className="dora-indicator-title">宝牌指示牌</span>
      <div className="dora-indicator-slots">
        {slots.map((tile, index) => (
          <span key={tile?.instanceId ?? `dora-back-${index}`} className="dora-indicator-slot" data-dora-open={tile ? 'true' : 'false'}>
            <Tile tile={tile ?? undefined} faceDown={!tile} compact doraGlowEnabled={false} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
          </span>
        ))}
      </div>
      <div className="dora-round-summary">
        <span>{roundText(gameState, matchState)}　{gameState.honba}本场</span>
        <span>供托{gameState.riichiSticks}</span>
      </div>
    </aside>
  );
}

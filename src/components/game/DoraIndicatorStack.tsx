import type { MatchState } from '../../game/match/types';
import type { GameState, TileId, Wind } from '../../game/types';
import {
  buildDoraIndicatorSlots,
  type DoraIndicatorSlot,
} from '../../presentation/table/TablePresentationContract';
import { Tile } from '../Tile';

interface DoraIndicatorStackProps {
  gameState: Pick<GameState, 'doraIndicators' | 'honba' | 'riichiSticks' | 'roundWind'>;
  matchState?: Pick<MatchState, 'roundWind' | 'handNumber'>;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  slots?: readonly DoraIndicatorSlot[];
}

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

export function DoraIndicatorStack({ gameState, matchState, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange, slots }: DoraIndicatorStackProps) {
  const indicatorSlots = slots ?? buildDoraIndicatorSlots(gameState.doraIndicators);

  return (
    <aside className="dora-indicator-stack" aria-label="宝牌指示牌">
      <span className="dora-indicator-title">宝牌指示牌</span>
      <div className="dora-indicator-slots">
        {indicatorSlots.map((slot) => (
          <span key={slot.state === 'revealed' ? slot.tile.instanceId : `dora-back-${slot.index}`} className="dora-indicator-slot" data-dora-open={slot.state === 'revealed' ? 'true' : 'false'} data-dora-state={slot.state}>
            <Tile tile={slot.state === 'revealed' ? slot.tile : undefined} faceDown={slot.state === 'hidden'} compact doraGlowEnabled={false} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
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

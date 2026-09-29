import { callsToMeldDisplayModels } from '../game/meldDisplayAdapter';
import type { PlayerState, Tile as TileModel, TileId } from '../game/types';
import { MeldDisplay } from './MeldDisplay';

interface PlayerMeldsProps {
  player: PlayerState;
  displayMelds?: import('../game/meldDisplayAdapter').MeldDisplayModel[];
  seatClass?: string;
  doraIndicators?: TileModel[];
  doraGlowEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
}

export function PlayerMelds({ player, displayMelds, seatClass = '', doraIndicators = [], doraGlowEnabled = true, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange }: PlayerMeldsProps) {
  const melds = displayMelds ?? callsToMeldDisplayModels(player.calls, player.id);
  if (melds.length === 0) return null;
  return (
    <div className={`player-melds ${seatClass}`} aria-label={`${player.name} 副露`}>
      {melds.map((meld) => (
        <MeldDisplay key={`${meld.callType}-${meld.declaredAtTurn}`} meld={meld} seatClass={seatClass} doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
      ))}
    </div>
  );
}

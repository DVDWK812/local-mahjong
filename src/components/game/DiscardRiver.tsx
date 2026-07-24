import type { PlayerState } from '../../game/types';
import { Tile } from '../Tile';

interface DiscardRiverProps {
  player: PlayerState;
  position: 'south' | 'east' | 'north' | 'west';
}

export function DiscardRiver({ player, position }: DiscardRiverProps) {
  const riichiDiscardInstanceId = player.riichiState?.riichiDiscardInstanceId;

  return (
    <div className={`discard-river discard-river--${position}`} aria-label={`${player.name} 牌河`} data-position={position}>
      <div className="discard-river-grid">
        {player.river.map((tile) => {
          const isRiichiDiscard = riichiDiscardInstanceId === tile.instanceId;
          return (
            <span key={tile.instanceId} className={`discard-river-tile ${isRiichiDiscard ? 'discard-river-tile--riichi riichi-discard-slot' : ''}`}>
              <Tile tile={tile} compact sideways={isRiichiDiscard} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

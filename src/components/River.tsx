import type { PlayerState } from '../game/types';
import { windLabel } from '../game/tileUtils';
import { Tile } from './Tile';

interface RiverProps {
  player: PlayerState;
}

export function River({ player }: RiverProps) {
  return (
    <section className="river">
      <div className="river-title">{windLabel(player.seatWind)} 河</div>
      <div className="river-grid">
        {player.river.map((tile) => (
          <Tile key={tile.instanceId} tile={tile} compact />
        ))}
      </div>
    </section>
  );
}

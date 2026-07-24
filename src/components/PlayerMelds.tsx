import { callsToMeldDisplayModels } from '../game/meldDisplayAdapter';
import type { PlayerState } from '../game/types';
import { MeldDisplay } from './MeldDisplay';

interface PlayerMeldsProps {
  player: PlayerState;
  seatClass?: string;
}

export function PlayerMelds({ player, seatClass = '' }: PlayerMeldsProps) {
  const melds = callsToMeldDisplayModels(player.calls, player.id);
  if (melds.length === 0) return null;
  return (
    <div className={`player-melds ${seatClass}`} aria-label={`${player.name} 副露`}>
      {melds.map((meld) => (
        <MeldDisplay key={`${meld.callType}-${meld.declaredAtTurn}`} meld={meld} seatClass={seatClass} />
      ))}
    </div>
  );
}

import type { PlayerId, PlayerState, Wind } from '../../game/types';
import { PlayerMelds } from '../PlayerMelds';
import { DiscardRiver } from './DiscardRiver';
import { HandTrack } from './HandTrack';

export type PlayerPosition = 'south' | 'east' | 'north' | 'west';

interface PlayerZoneProps {
  playerIndex: PlayerId;
  position: PlayerPosition;
  player: PlayerState;
  score: number;
  seatWind: Wind;
  isDealer: boolean;
  isCurrentPlayer: boolean;
  showHand?: boolean;
  showRiver?: boolean;
}

const windNames: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

export function PlayerZone({
  playerIndex,
  position,
  player,
  score,
  seatWind,
  isDealer,
  isCurrentPlayer,
  showHand = true,
  showRiver = true,
}: PlayerZoneProps) {
  const showOpponentHand = showHand;
  void score;

  return (
    <section
      className={`player-zone player-zone--${position} ${showOpponentHand ? '' : 'player-zone--river-only'} ${showRiver ? '' : 'player-zone--no-river'} ${isCurrentPlayer ? 'player-zone--current' : ''}`}
      data-player-zone={position}
      data-player-index={playerIndex}
      aria-label={`${player.name} 区域`}
    >
      <div className="player-zone-layout">
        {showOpponentHand ? (
          <div className="player-zone-hand-wrap">
            <HandTrack player={player} position={position} />
          </div>
        ) : null}

        {showOpponentHand ? (
          <PlayerIdentity player={player} seatWind={seatWind} isDealer={isDealer} />
        ) : null}

        {showRiver ? (
          <div className="player-zone-river-wrap">
            <DiscardRiver player={player} position={position} />
          </div>
        ) : null}

        {showOpponentHand ? (
          <div className="player-zone-meld-wrap">
            <PlayerMelds player={player} seatClass={`seat-${player.id} melds-${position}`} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PlayerIdentity({ player, seatWind, isDealer }: { player: PlayerState; seatWind: Wind; isDealer: boolean }) {
  const initial = player.name.trim().slice(0, 1) || windNames[seatWind];
  return (
    <div className="player-identity player-zone-label">
      <span className="player-avatar" aria-hidden="true">{initial}</span>
      <strong title={player.name}>{player.name}</strong>
      <span className="player-badges">
        {isDealer ? <em className="dealer-marker">庄</em> : null}
        {player.riichi ? <em>立直</em> : null}
      </span>
    </div>
  );
}

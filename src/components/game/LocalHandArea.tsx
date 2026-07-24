import type { PlayerId, PlayerState, Wind } from '../../game/types';
import { PlayerMelds } from '../PlayerMelds';
import { Tile } from '../Tile';

interface LocalHandAreaProps {
  player: PlayerState;
  isCurrent: boolean;
  canDiscard: boolean;
  allowedDiscardInstanceIds?: string[];
  onDiscard: (playerId: PlayerId, tileInstanceId: string) => void;
}

const windNames: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

export function LocalHandArea({ player, isCurrent, canDiscard, allowedDiscardInstanceIds, onDiscard }: LocalHandAreaProps) {
  const drawnTileId = player.drawnTile?.instanceId;
  const baseTiles = drawnTileId ? player.hand.filter((tile) => tile.instanceId !== drawnTileId) : player.hand;
  const drawnTile = drawnTileId ? player.hand.find((tile) => tile.instanceId === drawnTileId) : null;
  const canClick = (tileInstanceId: string) =>
    canDiscard && (!allowedDiscardInstanceIds || allowedDiscardInstanceIds.includes(tileInstanceId));

  return (
    <section className={`local-hand-area ${isCurrent ? 'local-hand-area--active' : ''}`} aria-label="本家手牌">
      <div className="local-hand-info">
        <span className="player-avatar" aria-hidden="true">{player.name.trim().slice(0, 1) || windNames[player.seatWind]}</span>
        <strong title={player.name}>{player.name}</strong>
        <span className="player-badges">
          {player.seatWind === 'east' ? <em className="dealer-marker">庄</em> : null}
          {player.riichi ? <em>立直</em> : null}
        </span>
      </div>
      <div className="local-hand-track">
        <div className="local-hand-row">
          {baseTiles.map((tile) => (
            <Tile
              key={tile.instanceId}
              tile={tile}
              clickable={canClick(tile.instanceId)}
              disabled={!canClick(tile.instanceId)}
              onClick={canClick(tile.instanceId) ? () => onDiscard(player.id, tile.instanceId) : undefined}
            />
          ))}
          {drawnTile ? (
            <span className="drawn-tile-gap">
              <Tile
                tile={drawnTile}
                selected
                clickable={canClick(drawnTile.instanceId)}
                disabled={!canClick(drawnTile.instanceId)}
                onClick={canClick(drawnTile.instanceId) ? () => onDiscard(player.id, drawnTile.instanceId) : undefined}
              />
            </span>
          ) : null}
        </div>
      </div>
      <div className="local-meld-track">
        <PlayerMelds player={player} seatClass="seat-0 local-melds" />
      </div>
    </section>
  );
}

import type { PlayerId, PlayerState } from '../game/types';
import { Tile } from './Tile';
import { windLabel } from '../game/tileUtils';
import { PlayerMelds } from './PlayerMelds';

interface HandProps {
  player: PlayerState;
  isCurrent: boolean;
  isLocal: boolean;
  canDiscard: boolean;
  allowedDiscardInstanceIds?: string[];
  onDiscard: (playerId: PlayerId, tileInstanceId: string) => void;
}

export function Hand({ player, isCurrent, isLocal, canDiscard, allowedDiscardInstanceIds, onDiscard }: HandProps) {
  const drawnTileId = player.drawnTile?.instanceId;
  const baseTiles = isLocal && drawnTileId
    ? player.hand.filter((tile) => tile.instanceId !== drawnTileId)
    : player.hand;
  const drawnTile = isLocal && drawnTileId
    ? player.hand.find((tile) => tile.instanceId === drawnTileId)
    : null;

  const canClick = (tileInstanceId: string) =>
    canDiscard
    && isLocal
    && (!allowedDiscardInstanceIds || allowedDiscardInstanceIds.includes(tileInstanceId));

  return (
    <section className={`hand-panel ${isCurrent ? 'hand-panel--active' : ''}`}>
      <div className="panel-title">
        <strong>{windLabel(player.seatWind)}家</strong>
        <span>{player.name}</span>
      </div>
      <div className="hand-with-melds">
        <div className="hand-row">
          {baseTiles.map((tile) => (
            <Tile
              key={tile.instanceId}
              tile={isLocal ? tile : undefined}
              hidden={!isLocal}
              selected={false}
              onClick={canClick(tile.instanceId) ? () => onDiscard(player.id, tile.instanceId) : undefined}
            />
          ))}
          {drawnTile ? (
            <span className="drawn-tile-gap">
              <Tile
                tile={drawnTile}
                drawn
                onClick={canClick(drawnTile.instanceId) ? () => onDiscard(player.id, drawnTile.instanceId) : undefined}
              />
            </span>
          ) : null}
        </div>
        <PlayerMelds player={player} seatClass={`seat-${player.id}`} />
      </div>
    </section>
  );
}

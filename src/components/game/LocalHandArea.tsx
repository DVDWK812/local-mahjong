import type { PlayerId, PlayerState, Tile as TileModel, TileId, Wind } from '../../game/types';
import { PlayerMelds } from '../PlayerMelds';
import { Tile } from '../Tile';

interface LocalHandAreaProps {
  player: PlayerState;
  isCurrent: boolean;
  canDiscard: boolean;
  allowedDiscardInstanceIds?: string[];
  kuikaeForbiddenTileIds?: TileId[];
  doraIndicators?: TileModel[];
  doraGlowEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  tsumoGiriDisplayEnabled?: boolean;
  concealHand?: boolean;
  onDiscardPreviewChange?: (tileInstanceId: string | null) => void;
  onDiscard: (playerId: PlayerId, tileInstanceId: string) => void;
}

const windNames: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

export function LocalHandArea({ player, isCurrent, canDiscard, allowedDiscardInstanceIds, kuikaeForbiddenTileIds = [], doraIndicators = [], doraGlowEnabled = true, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange, tsumoGiriDisplayEnabled = true, concealHand = false, onDiscardPreviewChange, onDiscard }: LocalHandAreaProps) {
  const drawnTileId = player.drawnTile?.instanceId;
  const baseTiles = drawnTileId ? player.hand.filter((tile) => tile.instanceId !== drawnTileId) : player.hand;
  const drawnTile = drawnTileId ? player.hand.find((tile) => tile.instanceId === drawnTileId) : null;
  const canClick = (tileInstanceId: string) =>
    !concealHand && canDiscard && (!allowedDiscardInstanceIds || allowedDiscardInstanceIds.includes(tileInstanceId));
  const isKuikaeForbidden = (tileId: TileId) => kuikaeForbiddenTileIds.includes(tileId);
  const handleDiscard = (tileInstanceId: string) => {
    onDiscardPreviewChange?.(null);
    onHoveredTileTypeChange?.(null);
    onDiscard(player.id, tileInstanceId);
    onHoveredTileTypeChange?.(null);
  };

  return (
    <section className={`local-hand-area ${isCurrent ? 'local-hand-area--active' : ''}`} aria-label="本家手牌" data-local-player={player.id}>
      <div className="local-hand-info">
        <span className="player-avatar" aria-hidden="true">{player.name.trim().slice(0, 1) || windNames[player.seatWind]}</span>
        {tsumoGiriDisplayEnabled ? <TsumogiriMarker player={player} /> : null}
        <strong title={player.name}>{player.name}</strong>
        <span className="player-badges">
          {player.seatWind === 'east' ? <em className="dealer-marker">庄</em> : null}
          {player.riichi ? <em>立直</em> : null}
          {kuikaeForbiddenTileIds.length > 0 ? <em className="kuikae-warning">食替禁止</em> : null}
        </span>
      </div>
      <div className="local-hand-track hand-slot hand-slot--bottom" data-hand-slot="bottom">
        <div className="local-hand-row">
          {baseTiles.map((tile) => (
            <Tile
              key={tile.instanceId}
              tile={concealHand ? undefined : tile}
              faceDown={concealHand}
              clickable={canClick(tile.instanceId)}
              disabled={!canClick(tile.instanceId)}
              doraIndicators={doraIndicators}
              doraGlowEnabled={!concealHand && doraGlowEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={onHoveredTileTypeChange}
              interactive={canClick(tile.instanceId)}
              className={isKuikaeForbidden(tile.id) ? 'tile--kuikae-forbidden' : undefined}
              onPointerEnter={canClick(tile.instanceId) ? () => onDiscardPreviewChange?.(tile.instanceId) : undefined}
              onPointerLeave={canClick(tile.instanceId) ? () => onDiscardPreviewChange?.(null) : undefined}
              onPointerDown={canClick(tile.instanceId) ? () => onHoveredTileTypeChange?.(null) : undefined}
              onClick={canClick(tile.instanceId) ? () => handleDiscard(tile.instanceId) : undefined}
            />
          ))}
          {drawnTile ? (
            <span className="drawn-tile-gap">
              <Tile
                tile={concealHand ? undefined : drawnTile}
                faceDown={concealHand}
                selected
                clickable={canClick(drawnTile.instanceId)}
                disabled={!canClick(drawnTile.instanceId)}
                doraIndicators={doraIndicators}
                doraGlowEnabled={!concealHand && doraGlowEnabled}
                hoveredTileType={hoveredTileType}
                sameTileHoverEnabled={sameTileHoverEnabled}
                onHoveredTileTypeChange={onHoveredTileTypeChange}
                interactive={canClick(drawnTile.instanceId)}
                className={isKuikaeForbidden(drawnTile.id) ? 'tile--kuikae-forbidden' : undefined}
                onPointerEnter={canClick(drawnTile.instanceId) ? () => onDiscardPreviewChange?.(drawnTile.instanceId) : undefined}
                onPointerLeave={canClick(drawnTile.instanceId) ? () => onDiscardPreviewChange?.(null) : undefined}
                onPointerDown={canClick(drawnTile.instanceId) ? () => onHoveredTileTypeChange?.(null) : undefined}
                onClick={canClick(drawnTile.instanceId) ? () => handleDiscard(drawnTile.instanceId) : undefined}
              />
            </span>
          ) : null}
        </div>
      </div>
      <div className="local-meld-track">
        <PlayerMelds player={player} seatClass="seat-bottom local-melds" doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
      </div>
    </section>
  );
}

function TsumogiriMarker({ player }: { player: PlayerState }) {
  const lastDiscard = player.river[player.river.length - 1];
  const isTsumogiri = lastDiscard?.isTsumogiri === true;
  return (
    <span className={`tsumogiri-marker ${isTsumogiri ? 'tsumogiri-marker--drawn' : 'tsumogiri-marker--blocked'}`} title={isTsumogiri ? '摸切' : '非摸切'}>
      切
    </span>
  );
}

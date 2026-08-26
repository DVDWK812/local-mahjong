import type { PlayerId, PlayerState, Tile as TileModel, TileId, Wind } from '../../game/types';
import type { DiscardSourceCapture } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import type { PlayerProfile } from '../../profile/playerProfile';
import { PlayerMelds } from '../PlayerMelds';
import { PlayerAvatar } from '../PlayerAvatar';
import { Tile } from '../Tile';

interface LocalHandAreaProps {
  player: PlayerState;
  identityPlayer?: PlayerState;
  meldPlayer?: PlayerState;
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
  onDiscardSourceCapture?: (capture: DiscardSourceCapture) => (() => void) | void;
  onDiscard: (playerId: PlayerId, tileInstanceId: string) => void;
  playerProfile?: PlayerProfile;
}

const windNames: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

export function LocalHandArea({ player, identityPlayer = player, meldPlayer = player, isCurrent, canDiscard, allowedDiscardInstanceIds, kuikaeForbiddenTileIds = [], doraIndicators = [], doraGlowEnabled = true, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange, tsumoGiriDisplayEnabled = true, concealHand = false, onDiscardPreviewChange, onDiscardSourceCapture, onDiscard, playerProfile }: LocalHandAreaProps) {
  const drawnTileId = player.drawnTile?.instanceId;
  const baseTiles = drawnTileId ? player.hand.filter((tile) => tile.instanceId !== drawnTileId) : player.hand;
  const drawnTile = drawnTileId ? player.hand.find((tile) => tile.instanceId === drawnTileId) : null;
  const canClick = (tileInstanceId: string) =>
    !concealHand && canDiscard && (!allowedDiscardInstanceIds || allowedDiscardInstanceIds.includes(tileInstanceId));
  const isKuikaeForbidden = (tileId: TileId) => kuikaeForbiddenTileIds.includes(tileId);
  const displayName = playerProfile?.nickname ?? identityPlayer.name;
  const handleDiscard = (tile: TileModel, sourceElement: HTMLButtonElement) => {
    const tileInstanceId = tile.instanceId;
    const clearSourceSnapshot = onDiscardSourceCapture?.({
      playerId: player.id,
      tileInstanceId,
      tile: { id: tile.id, red: tile.red },
      sourceTileRect: copyRect(sourceElement.getBoundingClientRect()),
    });
    onDiscardPreviewChange?.(null);
    onHoveredTileTypeChange?.(null);
    try {
      onDiscard(player.id, tileInstanceId);
    } catch (error) {
      clearSourceSnapshot?.();
      throw error;
    }
    scheduleSnapshotExpiry(clearSourceSnapshot);
    onHoveredTileTypeChange?.(null);
  };

  return (
    <section className={`local-hand-area ${isCurrent ? 'local-hand-area--active' : ''} ${isCurrent && canDiscard ? 'local-hand-area--interactive' : ''}`} aria-label="本家手牌" data-local-player={player.id}>
      <div className="local-hand-info local-hand-info--vertical" data-player-frame-layout="vertical">
        {playerProfile
          ? <PlayerAvatar avatarId={playerProfile.avatarId} />
          : <span className="player-avatar" aria-hidden="true">{identityPlayer.name.trim().slice(0, 1) || windNames[identityPlayer.seatWind]}</span>}
        <span className="local-hand-info-copy">
          <strong title={displayName}>{displayName}</strong>
          <span className="local-hand-status">
            {tsumoGiriDisplayEnabled ? <TsumogiriMarker player={identityPlayer} /> : null}
          </span>
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
              interactive
              className={isKuikaeForbidden(tile.id) ? 'tile--kuikae-forbidden' : undefined}
              onPointerEnter={canClick(tile.instanceId) ? () => onDiscardPreviewChange?.(tile.instanceId) : undefined}
              onPointerLeave={canClick(tile.instanceId) ? () => onDiscardPreviewChange?.(null) : undefined}
              onPointerDown={canClick(tile.instanceId) ? () => onHoveredTileTypeChange?.(null) : undefined}
              onClick={canClick(tile.instanceId) ? (event) => handleDiscard(tile, event.currentTarget) : undefined}
            />
          ))}
          {drawnTile ? (
            <span className="drawn-tile-gap">
              <Tile
                tile={concealHand ? undefined : drawnTile}
                faceDown={concealHand}
                drawn
                clickable={canClick(drawnTile.instanceId)}
                disabled={!canClick(drawnTile.instanceId)}
                doraIndicators={doraIndicators}
                doraGlowEnabled={!concealHand && doraGlowEnabled}
                hoveredTileType={hoveredTileType}
                sameTileHoverEnabled={sameTileHoverEnabled}
                onHoveredTileTypeChange={onHoveredTileTypeChange}
                interactive
                className={isKuikaeForbidden(drawnTile.id) ? 'tile--kuikae-forbidden' : undefined}
                onPointerEnter={canClick(drawnTile.instanceId) ? () => onDiscardPreviewChange?.(drawnTile.instanceId) : undefined}
                onPointerLeave={canClick(drawnTile.instanceId) ? () => onDiscardPreviewChange?.(null) : undefined}
                onPointerDown={canClick(drawnTile.instanceId) ? () => onHoveredTileTypeChange?.(null) : undefined}
                onClick={canClick(drawnTile.instanceId) ? (event) => handleDiscard(drawnTile, event.currentTarget) : undefined}
              />
            </span>
          ) : null}
        </div>
      </div>
      <div className="local-meld-track" data-meld-player={meldPlayer.id} data-table-meld-zone="south">
        <PlayerMelds player={meldPlayer} seatClass="seat-bottom local-melds" doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
      </div>
    </section>
  );
}

function copyRect(rect: DOMRect): DiscardSourceCapture['sourceTileRect'] {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function scheduleSnapshotExpiry(clearSnapshot: (() => void) | void): void {
  if (!clearSnapshot) return;
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => clearSnapshot());
    return;
  }
  setTimeout(clearSnapshot, 0);
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

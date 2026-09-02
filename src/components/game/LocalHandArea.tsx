import type { CSSProperties } from 'react';
import type { PlayerId, PlayerState, Tile as TileModel, TileId, Wind } from '../../game/types';
import { createTile } from '../../game/tileUtils';
import type { DiscardSourceCapture, DiscardSourceSnapshot } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import type {
  LocalHandPresentation,
  TableInteractionActions,
} from '../../presentation/table/TablePresentationContract';
import type { PlayerProfile } from '../../profile/playerProfile';
import type { LocalHandAnimation3DState } from '../../presentation3d/animation/tableAnimation3D';
import { getLocalHandScreenOffset } from '../../presentation3d/table/tablePresentationTuning';
import { PlayerMelds } from '../PlayerMelds';
import { PlayerAvatar } from '../PlayerAvatar';
import { Tile } from '../Tile';

interface LocalHandAreaProps {
  player: PlayerState;
  identityPlayer?: PlayerState;
  meldPlayer?: PlayerState;
  isCurrent: boolean;
  canDiscard: boolean;
  allowedDiscardInstanceIds?: readonly string[];
  kuikaeForbiddenTileIds?: readonly TileId[];
  doraIndicators?: TileModel[];
  doraGlowEnabled?: boolean;
  doraBorderEnabled?: boolean;
  doraBreathingEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  tsumoGiriDisplayEnabled?: boolean;
  concealHand?: boolean;
  onDiscardPreviewChange?: (tileInstanceId: string | null) => void;
  onDiscardSourceCapture?: (capture: DiscardSourceCapture) => (() => void) | void;
  onDiscard: (playerId: PlayerId, tileInstanceId: string) => void;
  playerProfile?: PlayerProfile;
  presentation?: LocalHandPresentation;
  interactionActions?: TableInteractionActions;
  screenSpaceOverlay?: boolean;
  retainDiscardSourceSnapshot?: boolean;
  discardSnapshot?: DiscardSourceSnapshot | null;
  localHandAnimation?: LocalHandAnimation3DState | null;
}

const windNames: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

export function LocalHandArea({ player, identityPlayer = player, meldPlayer = player, isCurrent, canDiscard, allowedDiscardInstanceIds, kuikaeForbiddenTileIds = [], doraIndicators = [], doraGlowEnabled = true, doraBorderEnabled = true, doraBreathingEnabled = true, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange, tsumoGiriDisplayEnabled = true, concealHand = false, onDiscardPreviewChange, onDiscardSourceCapture, onDiscard, playerProfile, presentation, interactionActions, screenSpaceOverlay = false, retainDiscardSourceSnapshot = false, discardSnapshot = null, localHandAnimation = null }: LocalHandAreaProps) {
  const drawnTileId = player.drawnTile?.instanceId;
  const presentationTiles = presentation?.tiles.map((entry) => entry.tile) ?? player.hand;
  const presentationById = new Map(presentation?.tiles.map((entry) => [entry.tile.instanceId, entry]));
  const effectiveDrawnTileId = presentation?.drawnTileInstanceId ?? drawnTileId;
  const baseTiles = effectiveDrawnTileId
    ? presentationTiles.filter((tile) => tile.instanceId !== effectiveDrawnTileId)
    : presentationTiles;
  const drawnTile = effectiveDrawnTileId
    ? presentationTiles.find((tile) => tile.instanceId === effectiveDrawnTileId)
    : null;
  const canClick = (tileInstanceId: string) =>
    !concealHand && (presentation
      ? presentationById.get(tileInstanceId)?.playable === true
      : canDiscard && (!allowedDiscardInstanceIds || allowedDiscardInstanceIds.includes(tileInstanceId)));
  const effectiveKuikaeForbiddenTileIds = presentation?.kuikaeForbiddenTileIds ?? kuikaeForbiddenTileIds;
  const isKuikaeForbidden = (tileId: TileId) => effectiveKuikaeForbiddenTileIds.includes(tileId);
  const selectTile = (tileInstanceId: string | null) => {
    if (interactionActions) interactionActions.selectTile(tileInstanceId);
    else onDiscardPreviewChange?.(tileInstanceId);
  };
  const displayName = playerProfile?.nickname ?? identityPlayer.name;
  const handleDiscard = (tile: TileModel, sourceElement: HTMLButtonElement) => {
    const tileInstanceId = tile.instanceId;
    const clearSourceSnapshot = onDiscardSourceCapture?.({
      playerId: player.id,
      tileInstanceId,
      tile: { id: tile.id, red: tile.red },
      sourceTileRect: copyRect(sourceElement.getBoundingClientRect()),
    });
    selectTile(null);
    onHoveredTileTypeChange?.(null);
    try {
      if (interactionActions) interactionActions.discard(tileInstanceId);
      else onDiscard(player.id, tileInstanceId);
    } catch (error) {
      clearSourceSnapshot?.();
      throw error;
    }
    if (!retainDiscardSourceSnapshot) scheduleSnapshotExpiry(clearSourceSnapshot);
    onHoveredTileTypeChange?.(null);
  };

  const localDrawPhase = localHandAnimation?.kind === 'draw' ? localHandAnimation.phase : null;
  const snapshotTile = discardSnapshot
    ? { ...createTile(discardSnapshot.tile.id, -1), red: discardSnapshot.tile.red, instanceId: discardSnapshot.tileInstanceId }
    : null;
  const localHandScreenOffset = getLocalHandScreenOffset();

  return (
    <>
    <section className={`local-hand-area ${isCurrent ? 'local-hand-area--active' : ''} ${isCurrent && (presentation?.canDiscard ?? canDiscard) ? 'local-hand-area--interactive' : ''} ${screenSpaceOverlay ? 'local-hand-area--screen-space' : ''} ${screenSpaceOverlay && !doraBorderEnabled ? 'local-hand-area--dora-border-disabled' : ''} ${screenSpaceOverlay && !doraBreathingEnabled ? 'local-hand-area--dora-breathing-disabled' : ''}`} aria-label="本家手牌" data-local-player={player.id} data-table-presentation={presentation ? 'shared' : 'legacy'} data-local-hand-space={screenSpaceOverlay ? 'screen' : 'table'} data-local-hand-animation-event={localHandAnimation?.eventId} data-local-hand-animation-kind={localHandAnimation?.kind} data-local-hand-animation-phase={localHandAnimation?.phase} style={screenSpaceOverlay ? {
      '--local-hand-tuning-x': `${localHandScreenOffset.x}px`,
      '--local-hand-tuning-y': `${localHandScreenOffset.y}px`,
    } as CSSProperties : undefined}>
      {screenSpaceOverlay ? null : <div className="local-hand-info local-hand-info--vertical" data-player-frame-layout="vertical">
        {playerProfile
          ? <PlayerAvatar avatarId={playerProfile.avatarId} />
          : <span className="player-avatar" aria-hidden="true">{identityPlayer.name.trim().slice(0, 1) || windNames[identityPlayer.seatWind]}</span>}
        <span className="local-hand-info-copy">
          <strong title={displayName}>{displayName}</strong>
          <span className="local-hand-status">
            {tsumoGiriDisplayEnabled ? <TsumogiriMarker player={identityPlayer} /> : null}
          </span>
        </span>
      </div>}
      <div className="local-hand-track hand-slot hand-slot--bottom" data-hand-slot="bottom">
        <div className="local-hand-row">
          {baseTiles.map((tile) => (
            <Tile
              key={tile.instanceId}
              tile={concealHand ? undefined : tile}
              faceDown={concealHand}
              selected={presentationById.get(tile.instanceId)?.selected === true}
              riichiCandidate={screenSpaceOverlay && presentationById.get(tile.instanceId)?.riichiCandidate === true}
              clickable={canClick(tile.instanceId)}
              disabled={!canClick(tile.instanceId)}
              doraIndicators={doraIndicators}
              doraGlowEnabled={!concealHand && doraGlowEnabled}
              doraSweepEnabled={screenSpaceOverlay && doraBreathingEnabled}
              hoveredTileType={hoveredTileType}
              sameTileHoverEnabled={sameTileHoverEnabled}
              onHoveredTileTypeChange={onHoveredTileTypeChange}
              interactive
              className={isKuikaeForbidden(tile.id) ? 'tile--kuikae-forbidden' : undefined}
              onPointerEnter={canClick(tile.instanceId) ? () => selectTile(tile.instanceId) : undefined}
              onPointerLeave={canClick(tile.instanceId) ? () => selectTile(null) : undefined}
              onPointerDown={canClick(tile.instanceId) ? () => onHoveredTileTypeChange?.(null) : undefined}
              onClick={canClick(tile.instanceId) ? (event) => handleDiscard(tile, event.currentTarget) : undefined}
            />
          ))}
          {drawnTile ? (
            <span className={`drawn-tile-gap ${localDrawPhase ? 'drawn-tile-gap--animating' : ''}`} data-local-draw-phase={localDrawPhase ?? undefined}>
              <Tile
                tile={concealHand ? undefined : drawnTile}
                faceDown={concealHand}
                selected={presentationById.get(drawnTile.instanceId)?.selected === true}
                drawn
                riichiCandidate={screenSpaceOverlay && presentationById.get(drawnTile.instanceId)?.riichiCandidate === true}
                clickable={canClick(drawnTile.instanceId)}
                disabled={!canClick(drawnTile.instanceId)}
                doraIndicators={doraIndicators}
                doraGlowEnabled={!concealHand && doraGlowEnabled}
                doraSweepEnabled={screenSpaceOverlay && doraBreathingEnabled}
                hoveredTileType={hoveredTileType}
                sameTileHoverEnabled={sameTileHoverEnabled}
                onHoveredTileTypeChange={onHoveredTileTypeChange}
                interactive
                className={isKuikaeForbidden(drawnTile.id) ? 'tile--kuikae-forbidden' : undefined}
                onPointerEnter={canClick(drawnTile.instanceId) ? () => selectTile(drawnTile.instanceId) : undefined}
                onPointerLeave={canClick(drawnTile.instanceId) ? () => selectTile(null) : undefined}
                onPointerDown={canClick(drawnTile.instanceId) ? () => onHoveredTileTypeChange?.(null) : undefined}
                onClick={canClick(drawnTile.instanceId) ? (event) => handleDiscard(drawnTile, event.currentTarget) : undefined}
              />
            </span>
          ) : null}
        </div>
      </div>
      {screenSpaceOverlay ? null : <div className="local-meld-track" data-meld-player={meldPlayer.id} data-table-meld-zone="south">
        <PlayerMelds player={meldPlayer} seatClass="seat-bottom local-melds" doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
      </div>}
    </section>
    {screenSpaceOverlay && discardSnapshot && snapshotTile ? (
      <div
        className="local-hand-discard-snapshot"
        data-local-discard-snapshot={discardSnapshot.tileInstanceId}
        style={{
          left: discardSnapshot.sourceTileRect.left,
          top: discardSnapshot.sourceTileRect.top,
          width: discardSnapshot.sourceTileRect.width,
          height: discardSnapshot.sourceTileRect.height,
        } as CSSProperties}
        aria-hidden="true"
      >
        <Tile tile={snapshotTile} interactive={false} />
      </div>
    ) : null}
    </>
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

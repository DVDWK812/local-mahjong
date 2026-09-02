import type { ComponentProps, CSSProperties } from 'react';
import { DoraIndicatorStack } from '../components/game/DoraIndicatorStack';
import { MahjongTable } from '../components/game/MahjongTable';
import type { PlayerPosition } from '../components/game/PlayerZone';
import { TableCenter } from '../components/game/TableCenter';
import type { PlayerId, PlayerState } from '../game/types';
import { getSceneSeatMapping } from './sceneState/buildTableSceneState';
import { getAvatarFrameTuning, TABLE_PRESENTATION_TUNING } from './table/tablePresentationTuning';

export type Table3DHudProps = ComponentProps<typeof MahjongTable>;

const POSITIONS: readonly PlayerPosition[] = ['north', 'east', 'south', 'west'];

const PLAYER_SLOTS: Readonly<Record<PlayerPosition, 'top' | 'right' | 'bottom' | 'left'>> = {
  north: 'top',
  east: 'right',
  south: 'bottom',
  west: 'left',
};

export function Table3DHud({
  gameState,
  matchState,
  bottomPlayerId = 0,
  seatMapping,
  activeSeats,
  centerRoundLabel,
  centerRemainingLabel,
  centerCornerLabels,
  doraIndicatorSlots,
  hoveredTileType = null,
  sameTileHoverEnabled = true,
  onHoveredTileTypeChange,
  tsumoGiriDisplayEnabled = true,
}: Table3DHudProps) {
  const mapping = seatMapping ?? getSceneSeatMapping(bottomPlayerId);
  const seats: Record<PlayerPosition, PlayerId> = {
    south: mapping.bottomPlayerId,
    east: mapping.rightPlayerId,
    north: mapping.topPlayerId,
    west: mapping.leftPlayerId,
  };
  const visiblePositions = POSITIONS.filter((position) => !activeSeats || activeSeats.includes(position));
  return (
    <section className="table-3d-hud" aria-label="3D 牌桌信息层">
      <div className="table-3d-dora-layer" aria-label="3D 宝牌信息层">
        <DoraIndicatorStack
          gameState={gameState}
          matchState={matchState}
          slots={doraIndicatorSlots}
          hoveredTileType={hoveredTileType}
          sameTileHoverEnabled={sameTileHoverEnabled}
          onHoveredTileTypeChange={onHoveredTileTypeChange}
        />
      </div>
      {visiblePositions.map((position) => {
        const playerId = seats[position];
        const player = gameState.players[playerId];
        const frameTuning = getAvatarFrameTuning(PLAYER_SLOTS[position]);
        return (
          <div
            key={position}
            className={`table-3d-player-frame table-3d-player-frame--${position}`}
            data-player-slot={PLAYER_SLOTS[position]}
            data-player-zone={position}
            data-player-index={playerId}
            style={{
              '--avatar-frame-offset-x': `${frameTuning.x}px`,
              '--avatar-frame-offset-y': `${frameTuning.y}px`,
              '--avatar-frame-size': frameTuning.size,
            } as CSSProperties}
          >
            <Table3DPlayerFrame
              player={player}
              position={position}
              tsumoGiriDisplayEnabled={tsumoGiriDisplayEnabled}
            />
          </div>
        );
      })}
    </section>
  );
}

export function Table3DCentralHud({
  gameState,
  matchState,
  bottomPlayerId = 0,
  seatMapping,
  activeSeats,
  centerRoundLabel,
  centerRemainingLabel,
  centerCornerLabels,
}: Table3DHudProps) {
  const mapping = seatMapping ?? getSceneSeatMapping(bottomPlayerId);
  const seats: Record<PlayerPosition, PlayerId> = {
    south: mapping.bottomPlayerId,
    east: mapping.rightPlayerId,
    north: mapping.topPlayerId,
    west: mapping.leftPlayerId,
  };
  return (
    <div
      className="table-3d-console-hud"
      aria-label="3D 中央信息区"
      data-hud-anchor="central-console-3d"
      style={{
        '--table-3d-hud-font-size': TABLE_PRESENTATION_TUNING.centralHud.fontSize,
      } as CSSProperties}
    >
      <TableCenter
        gameState={gameState}
        matchState={matchState}
        seatMapping={mapping}
        activePlayerIds={activeSeats?.map((position) => seats[position])}
        roundLabel={centerRoundLabel}
        remainingLabel={centerRemainingLabel}
        centerCornerLabels={centerCornerLabels}
      />
    </div>
  );
}

function Table3DPlayerFrame({
  player,
  position,
  tsumoGiriDisplayEnabled,
}: Readonly<{
  player: PlayerState;
  position: PlayerPosition;
  tsumoGiriDisplayEnabled: boolean;
}>) {
  const initial = player.name.trim().slice(0, 1) || '玩';
  const lastDiscard = player.river[player.river.length - 1];
  const isTsumogiri = lastDiscard?.isTsumogiri === true;
  return (
    <div className={`table-3d-player-card table-3d-player-card--${position}`}>
      <span className="table-3d-player-avatar" aria-hidden="true">{initial}</span>
      <span className="table-3d-player-copy">
        <strong title={player.name}>{player.name}</strong>
        {tsumoGiriDisplayEnabled ? (
          <span
            className={`tsumogiri-marker ${isTsumogiri ? 'tsumogiri-marker--drawn' : 'tsumogiri-marker--blocked'}`}
            title={isTsumogiri ? '摸切' : '非摸切'}
          >
            切
          </span>
        ) : null}
      </span>
    </div>
  );
}

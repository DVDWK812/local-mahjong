import type { BuiltReplayState } from '../game/replay/roundReplay';
import type { GameState, PlayerId, Tile as TileModel, Wind } from '../game/types';
import { Tile } from './Tile';

interface ReplayWallPanelProps {
  replayState: BuiltReplayState;
  allOpen: boolean;
  cameraPlayerId: PlayerId;
  doraGlowEnabled?: boolean;
}

export function ReplayWallPanel({ replayState, allOpen, cameraPlayerId, doraGlowEnabled = true }: ReplayWallPanelProps) {
  const { wall } = replayState;
  if (!wall.available) {
    return <aside className="replay-wall replay-wall--missing">该牌谱未记录完整牌山。</aside>;
  }
  const drawnLiveIds = new Set(wall.drawnLiveTiles.map((tile) => tile.instanceId));
  const drawnDeadIds = new Set(wall.drawnDeadTiles.map((tile) => tile.instanceId));
  const publicIds = replayPublicTileInstanceIds(replayState.gameState);
  const publicDoraIds = new Set(replayState.gameState.doraIndicators.map((tile) => tile.instanceId));
  const viewerKnownIds = new Set(replayState.gameState.players[cameraPlayerId].hand.map((tile) => tile.instanceId));
  const visibleConsumedIds = new Set([...publicIds, ...viewerKnownIds]);
  const nextId = wall.nextLiveTile?.instanceId;

  return (
    <section className="replay-wall">
      <WallRow
        label="普通牌山"
        tiles={wall.originalLiveWall}
        consumedIds={drawnLiveIds}
        visibleConsumedIds={visibleConsumedIds}
        alwaysVisibleIds={new Set()}
        nextId={nextId}
        allOpen={allOpen}
        doraIndicators={replayState.gameState.doraIndicators}
        doraGlowEnabled={doraGlowEnabled}
      />
      <WallRow
        label="王牌（岭上／宝牌／里宝牌）"
        tiles={wall.originalDeadWall}
        consumedIds={drawnDeadIds}
        visibleConsumedIds={visibleConsumedIds}
        alwaysVisibleIds={publicDoraIds}
        allOpen={allOpen}
        doraIndicators={replayState.gameState.doraIndicators}
        doraGlowEnabled={doraGlowEnabled}
        deadWall
      />
      <div className="replay-wall__legend">
        {!allOpen ? <span>里宝牌保持牌背</span> : null}
      </div>
    </section>
  );
}

interface WallRowProps {
  label: string;
  tiles: TileModel[];
  consumedIds: Set<string>;
  visibleConsumedIds: Set<string>;
  alwaysVisibleIds: Set<string>;
  nextId?: string;
  allOpen: boolean;
  doraIndicators: TileModel[];
  doraGlowEnabled: boolean;
  deadWall?: boolean;
}

function WallRow({ label, tiles, consumedIds, visibleConsumedIds, alwaysVisibleIds, nextId, allOpen, doraIndicators, doraGlowEnabled, deadWall = false }: WallRowProps) {
  return (
    <section className="replay-wall__section" aria-label={label}>
      <strong>{label}</strong>
      <div className={`replay-wall__tiles ${deadWall ? 'replay-wall__tiles--dead-wall' : 'replay-wall__tiles--live-wall'}`}>
        {tiles.map((tile, index) => {
          const consumed = consumedIds.has(tile.instanceId);
          // consumed 只描述牌山记账；牌面必须由 instanceId 公开权限独立决定。
          const visible = allOpen
            || alwaysVisibleIds.has(tile.instanceId)
            || (consumed && visibleConsumedIds.has(tile.instanceId));
          const slotType = deadWall ? deadWallSlotLabel(index, alwaysVisibleIds.has(tile.instanceId)) : '';
          return (
            <span
              key={tile.instanceId}
              className={`replay-wall__slot${deadWall ? ' replay-wall__slot--dead-wall' : ''}${tile.instanceId === nextId ? ' replay-wall__slot--next' : ''}${consumed ? ' replay-wall-tile--drawn' : ''}`}
              title={consumed ? '已摸走' : tile.instanceId === nextId ? '下一张' : slotType}
            >
              <Tile
                tile={visible ? tile : undefined}
                faceDown={!visible}
                compact
                interactive={false}
                doraIndicators={consumed ? [] : doraIndicators}
                doraGlowEnabled={!consumed && doraGlowEnabled}
              />
              {slotType ? <small>{slotType}</small> : null}
            </span>
          );
        })}
      </div>
    </section>
  );
}

export function replayPublicTileInstanceIds(state: GameState): Set<string> {
  const publicIds = new Set<string>();
  for (const indicator of state.doraIndicators) publicIds.add(indicator.instanceId);
  for (const player of state.players) {
    for (const riverTile of player.river) publicIds.add(riverTile.instanceId);
    for (const call of player.calls) {
      for (const callTile of call.tiles) publicIds.add(callTile.instanceId);
    }
  }
  if (state.result?.type === 'tsumo' || state.result?.type === 'ron') {
    for (const winner of state.result.winners) {
      for (const tile of state.players[winner.winner].hand) publicIds.add(tile.instanceId);
      publicIds.add(winner.winTile.instanceId);
    }
  } else if (state.result?.type === 'exhaustive-draw') {
    for (const playerId of state.result.revealHands ?? []) {
      for (const tile of state.players[playerId].hand) publicIds.add(tile.instanceId);
    }
  }
  return publicIds;
}

export function currentDrawSeatLabel(replayState: BuiltReplayState): string {
  if (replayState.gameState.phase === 'round-ended') return '—';
  const player = replayState.gameState.players[replayState.gameState.currentPlayer];
  if (!player) return '—';
  const labels: Record<Wind, string> = {
    east: '东',
    south: '南',
    west: '西',
    north: '北',
  };
  return labels[player.seatWind] ?? '—';
}

function deadWallSlotLabel(index: number, isPublicIndicator: boolean): string {
  if (index < 4) return '岭上';
  if ([4, 6, 8, 10, 12].includes(index)) return isPublicIndicator ? '公开宝牌' : '宝牌';
  if ([5, 7, 9, 11, 13].includes(index)) return '里宝';
  return '王牌';
}

import { callsToMeldDisplayModels } from '../../game/meldDisplayAdapter';
import type { GameState, PlayerId, PlayerState, Tile } from '../../game/types';
import { deadWallSlotRole } from '../../game/wall';
import { resolveTileDoraVisualKind } from '../../presentation/table/tileVisualSemantics';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import type {
  HandSceneTile,
  MeldSceneState,
  RiverSceneTile,
  SeatSceneState,
  TableSceneSeatMapping,
  TableSceneState,
  TableSceneTile,
  WallSceneTile,
} from './tableSceneTypes';

export const INITIAL_LIVE_WALL_TILE_COUNT = 69;

export type BuildTableSceneStateOptions = Readonly<{
  bottomPlayerId?: PlayerId;
  seatMapping?: TableSceneSeatMapping;
  revealOpponentHands?: boolean;
  revealedPlayerId?: PlayerId;
  preserveClaimedDiscardGap?: boolean;
}>;

const SEAT_ORDER: readonly Table3DSeat[] = ['bottom', 'right', 'top', 'left'];

export function buildTableSceneState(
  gameState: GameState,
  options: BuildTableSceneStateOptions = {},
): TableSceneState {
  const mapping = options.seatMapping ?? getSceneSeatMapping(options.bottomPlayerId ?? 0);
  const playerIds: Record<Table3DSeat, PlayerId> = {
    bottom: mapping.bottomPlayerId,
    right: mapping.rightPlayerId,
    top: mapping.topPlayerId,
    left: mapping.leftPlayerId,
  };
  const preserveClaimedDiscardGap = options.preserveClaimedDiscardGap
    ?? gameState.ruleConfig?.preserveClaimedDiscardGap
    ?? false;

  const seats = Object.fromEntries(SEAT_ORDER.map((seat) => {
    const playerId = playerIds[seat];
    const player = requirePlayer(gameState.players, playerId);
    const handVisible = seat === 'bottom'
      || options.revealOpponentHands === true
      || options.revealedPlayerId === playerId;
    return [seat, buildSeatSceneState(
      player,
      seat,
      handVisible,
      preserveClaimedDiscardGap,
      gameState.doraIndicators,
    )];
  })) as Record<Table3DSeat, SeatSceneState>;

  return {
    seats,
    wall: buildLiveWall(gameState.wall),
    deadWall: buildDeadWall(gameState),
    doraIndicators: gameState.doraIndicators.map((tile) => publicTile(
      tile,
      'dora',
      gameState.doraIndicators,
    )),
  };
}

export function getSceneSeatMapping(bottomPlayerId: PlayerId): TableSceneSeatMapping {
  return {
    bottomPlayerId,
    rightPlayerId: ((bottomPlayerId + 1) % 4) as PlayerId,
    topPlayerId: ((bottomPlayerId + 2) % 4) as PlayerId,
    leftPlayerId: ((bottomPlayerId + 3) % 4) as PlayerId,
  };
}

function buildSeatSceneState(
  player: PlayerState,
  seat: Table3DSeat,
  handVisible: boolean,
  preserveClaimedDiscardGap: boolean,
  doraIndicators: readonly Tile[],
): SeatSceneState {
  return {
    seat,
    playerId: player.id,
    riichi: player.riichi,
    hand: buildHand(player, handVisible, doraIndicators),
    river: buildRiver(player, preserveClaimedDiscardGap, doraIndicators),
    melds: buildMelds(player, doraIndicators),
  };
}

function buildHand(
  player: PlayerState,
  visible: boolean,
  doraIndicators: readonly Tile[],
): HandSceneTile[] {
  const drawnTileKey = player.drawnTile?.instanceId;
  const baseTiles = drawnTileKey
    ? player.hand.filter((tile) => tile.instanceId !== drawnTileKey)
    : player.hand;
  const drawnTile = drawnTileKey
    ? player.hand.find((tile) => tile.instanceId === drawnTileKey)
    : undefined;

  return [...baseTiles, ...(drawnTile ? [drawnTile] : [])].map((tile) => ({
    key: `hand-${player.id}-${tile.instanceId}`,
    tile: visible ? tileDefinition(tile, doraIndicators) : undefined,
    faceState: visible ? 'face-up' : 'face-down',
    orientation: 'upright',
    drawn: tile.instanceId === drawnTileKey,
  }));
}

function buildRiver(
  player: PlayerState,
  preserveClaimedDiscardGap: boolean,
  doraIndicators: readonly Tile[],
): RiverSceneTile[] {
  const riichiDiscardInstanceId = player.riichiState?.riichiDiscardInstanceId;
  const river = preserveClaimedDiscardGap
    ? player.river
    : player.river.filter((tile) => !isClaimedDiscard(tile));

  return river.map((tile, layoutIndex) => {
    const claimed = isClaimedDiscard(tile);
    const isRiichi = tile.isRiichiDiscard === true
      || riichiDiscardInstanceId === tile.instanceId;
    return {
      key: `river-${player.id}-${tile.instanceId}`,
      tile: claimed ? undefined : tileDefinition(tile, doraIndicators),
      faceState: 'face-up',
      orientation: isRiichi ? 'sideways' : 'upright',
      riverIndex: player.river.findIndex((candidate) => candidate.instanceId === tile.instanceId),
      layoutIndex,
      claimed,
      visible: !claimed,
    };
  });
}

function buildMelds(player: PlayerState, doraIndicators: readonly Tile[]): MeldSceneState[] {
  return callsToMeldDisplayModels(player.calls, player.id).map((meld) => ({
    key: `meld-${player.id}-${meld.callType}-${meld.tiles.map((tile) => tile.instanceId).join('-')}`,
    callType: meld.callType,
    tiles: orderMeldTilesFor3D(meld).map((displayTile) => ({
      key: `meld-tile-${player.id}-${displayTile.instanceId}`,
      tile: displayTile.faceDown
        ? undefined
        : tileDefinition(displayTile.tile, doraIndicators),
      faceState: displayTile.faceDown ? 'face-down' : 'face-up',
      orientation: displayTile.sideways ? 'sideways' : 'upright',
      called: displayTile.called,
      stacked: displayTile.stacked,
    })),
  }));
}

function orderMeldTilesFor3D(meld: ReturnType<typeof callsToMeldDisplayModels>[number]) {
  // Shared display tiles are caller-local left-to-right; 3D meld packing consumes
  // array entries from its local right edge, so open triplet/kan bases need inversion.
  if (meld.callType === 'pon' || meld.callType === 'minkan') {
    return [...meld.tiles].reverse();
  }
  if (meld.callType === 'kakan') {
    const baseTiles = meld.tiles.filter((tile) => !tile.stacked).reverse();
    const calledIndex = meld.sourceRelation === 'left'
      ? baseTiles.length - 1
      : meld.sourceRelation === 'opposite'
        ? 1
        : 0;
    return [
      ...baseTiles.map((tile, index) => ({
        ...tile,
        sideways: index === calledIndex,
        called: index === calledIndex,
      })),
      ...meld.tiles.filter((tile) => tile.stacked).map((tile) => ({
        ...tile,
        sideways: false,
        called: false,
      })),
    ];
  }
  return meld.tiles;
}

function buildLiveWall(wall: readonly Tile[]): WallSceneTile[] {
  const consumedSlots = Math.max(0, INITIAL_LIVE_WALL_TILE_COUNT - wall.length);
  return wall.map((tile, index) => ({
    key: `wall-${tile.instanceId}`,
    faceState: 'face-down',
    orientation: 'upright',
    slotIndex: consumedSlots + index,
    visible: true,
  }));
}

function buildDeadWall(gameState: GameState): WallSceneTile[] {
  const revealedIndicators = new Set(gameState.doraIndicators.map((tile) => tile.instanceId));
  const usedRinshanCount = Math.max(0, gameState.doraIndicators.length - 1);
  const legacySlotOffset = Math.max(0, 14 - gameState.deadWall.length);

  return gameState.deadWall.map((tile, index) => {
    const slotIndex = index + legacySlotOffset;
    const role = deadWallSlotRole(slotIndex);
    const visible = role !== 'rinshan' || slotIndex >= usedRinshanCount;
    const faceUp = role === 'dora-indicator' && revealedIndicators.has(tile.instanceId);
    return {
      key: `dead-wall-${tile.instanceId}`,
      tile: faceUp ? tileDefinition(tile, gameState.doraIndicators) : undefined,
      faceState: faceUp ? 'face-up' : 'face-down',
      orientation: 'upright',
      slotIndex,
      visible,
      role,
    };
  });
}

function publicTile(
  tile: Tile,
  prefix: string,
  doraIndicators: readonly Tile[],
): TableSceneTile {
  return {
    key: `${prefix}-${tile.instanceId}`,
    tile: tileDefinition(tile, doraIndicators),
    faceState: 'face-up',
    orientation: 'upright',
  };
}

function tileDefinition(tile: Tile, doraIndicators: readonly Tile[]) {
  return {
    id: tile.id,
    red: tile.red,
    doraKind: resolveTileDoraVisualKind(tile, doraIndicators),
  } as const;
}

function isClaimedDiscard(tile: Tile): boolean {
  return tile.claimed === true || tile.claimedBy !== undefined;
}

function requirePlayer(players: readonly PlayerState[], playerId: PlayerId): PlayerState {
  const player = players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error(`Missing player ${playerId} for 3D table scene`);
  return player;
}

import type {
  MeldDeclaredPresentationEvent,
  RiichiDeclaredPresentationEvent,
  TileDiscardedPresentationEvent,
  TileDrawnPresentationEvent,
} from '../../presentation/PresentationEventBus';
import type { HandAnimationPhase } from '../../presentation/handAnimation/HandAnimationController';
import {
  getHandTileTransform,
  getMeldTileTransforms,
  getRiverTileRotationY,
  getRiverTileTransforms,
} from '../coordinates/sceneTransforms';
import { getSeatDirection, type Table3DSeat } from '../coordinates/seatTransforms';
import type { MeldSceneState, TableSceneState } from '../sceneState/tableSceneTypes';
import type { TileFaceState, TileOrientation } from '../tile/tileOrientation';
import type { TileDefinition } from '../tile/tileTextures';
import { getGroundedTileCenterY } from '../tile/tileGrounding';
import { getRiichiStickTransform } from '../riichi/RiichiStick3D';
import {
  getHandTileScale,
  TABLE_PRESENTATION_TUNING,
} from '../table/tablePresentationTuning';
import type { DiscardSource3DStore, WorldPoint3D } from './DiscardSource3D';
import { createHandPresentationSnapshot, type HandPresentationFrame, type HandPresentationSnapshot } from '../../presentation/handAnimation/HandPresentationSnapshot';

export type TableAnimation3DAction =
  | TileDrawnPresentationEvent
  | TileDiscardedPresentationEvent
  | RiichiDeclaredPresentationEvent
  | MeldDeclaredPresentationEvent;

export type TransientTile3DPlan = Readonly<{
  key: string;
  tile?: TileDefinition;
  faceState: TileFaceState;
  orientation: TileOrientation;
  source: WorldPoint3D;
  destination: WorldPoint3D;
  sourceRotationX: number;
  sourceRotationY: number;
  destinationRotationX: number;
  destinationRotationY: number;
  sourceScale: number;
  destinationScale: number;
}>; 

export type TableAnimation3DPlan = Readonly<{
  localDiscardMotion?: import('./localDiscardMotion').LocalDiscardMotion;
  handSnapshot?: HandPresentationSnapshot;
  action: TableAnimation3DAction;
  seat: Table3DSeat;
  entry: WorldPoint3D;
  source: WorldPoint3D;
  destination: WorldPoint3D;
  sourceRotationX: number;
  sourceRotationY: number;
  destinationRotationX: number;
  destinationRotationY: number;
  sourceScale: number;
  destinationScale: number;
  tile?: TileDefinition;
  faceState: TileFaceState;
  showPrimaryTile: boolean;
  transientTiles?: readonly TransientTile3DPlan[];
  stickProxy?: Readonly<{
    source: WorldPoint3D;
    destination: WorldPoint3D;
    sourceRotationY: number;
    destinationRotationY: number;
  }>;
  hiddenHandKey?: string;
  hiddenRiverKey?: string;
  hiddenMeldTileKeys?: readonly string[];
  hiddenRiichiSeat?: Table3DSeat;
  localDomDraw: boolean;
  localDiscardSnapshotReady?: boolean;
}>;

export type LocalHandAnimation3DState = Readonly<{
  progress?: number;
  discardMotion?: import('./localDiscardMotion').LocalDiscardMotion;
  handPresentation?: HandPresentationFrame;
  eventId: string;
  kind: 'draw' | 'discard';
  phase: 'enter' | 'proxy-ready' | HandAnimationPhase;
}>;

export type TableAnimation3DMotion = Readonly<{
  handPosition: WorldPoint3D;
  tilePosition: WorldPoint3D;
  tileRotationX: number;
  tileRotationY: number;
  tileScale: number;
  tileVisible: boolean;
}>;

const ENTRY_DISTANCE = 2.8;
const TILE_LIFT = 0.28;

export const TABLE_ANIMATION_3D_CADENCE = {
  drawHoldMs: 70,
  discardHoldMs: 110,
  riichiHoldMs: 100,
  meldHoldMs: 110,
  kanHoldMs: 130,
} as const;

export function getTableAnimation3DHoldMs(action: TableAnimation3DAction): number {
  if (action.type === 'tile_discarded') return TABLE_ANIMATION_3D_CADENCE.discardHoldMs;
  if (action.type === 'tile_drawn') return TABLE_ANIMATION_3D_CADENCE.drawHoldMs;
  if (action.type === 'riichi_declared') return TABLE_ANIMATION_3D_CADENCE.riichiHoldMs;
  return action.meldType === 'kan'
    ? TABLE_ANIMATION_3D_CADENCE.kanHoldMs
    : TABLE_ANIMATION_3D_CADENCE.meldHoldMs;
}

export function resolveTableAnimation3DPlan(
  action: TableAnimation3DAction,
  sceneState: TableSceneState,
  sourceStore: DiscardSource3DStore,
  sessionKey: string,
): TableAnimation3DPlan | null {
  const seat = findSeat(sceneState, action.playerId);
  if (!seat) return null;
  const seatState = sceneState.seats[seat];

  if (action.type === 'tile_drawn') {
    const drawnIndex = seatState.hand.findIndex((tile) => tile.drawn);
    if (drawnIndex < 0) return null;
    const drawnTile = seatState.hand[drawnIndex];
    const destinationTransform = getHandTileTransform(
      seat,
      drawnIndex,
      seatState.hand.length,
      true,
    );
    const entry = outwardPoint(seat, destinationTransform.position, ENTRY_DISTANCE);
    const source = lerpPoint(entry, destinationTransform.position, 0.34);
    return {
      action,
      seat,
      entry,
      source,
      destination: destinationTransform.position,
      sourceRotationX: destinationTransform.rotationX,
      sourceRotationY: destinationTransform.rotationY,
      destinationRotationX: destinationTransform.rotationX,
      destinationRotationY: destinationTransform.rotationY,
      sourceScale: getHandTileScale(seat),
      destinationScale: getHandTileScale(seat),
      tile: drawnTile.tile,
      faceState: drawnTile.faceState,
      showPrimaryTile: seat !== 'bottom',
      hiddenHandKey: seat === 'bottom' ? undefined : drawnTile.key,
      localDomDraw: seat === 'bottom',
    };
  }

  if (action.type === 'riichi_declared') {
    const destinationTransform = getRiichiStickTransform(seat);
    const sourceTransform = getFallbackHandSource(seat, seatState.hand.length);
    return {
      action,
      seat,
      entry: outwardPoint(seat, sourceTransform.position, ENTRY_DISTANCE),
      source: sourceTransform.position,
      destination: destinationTransform.position,
      sourceRotationX: 0,
      sourceRotationY: sourceTransform.rotationY,
      destinationRotationX: 0,
      destinationRotationY: destinationTransform.rotationY,
      sourceScale: 1,
      destinationScale: 1,
      faceState: 'face-up',
      showPrimaryTile: false,
      hiddenRiichiSeat: seat,
      localDomDraw: false,
      stickProxy: {
        source: sourceTransform.position,
        destination: destinationTransform.position,
        sourceRotationY: sourceTransform.rotationY,
        destinationRotationY: destinationTransform.rotationY,
      },
    };
  }

  if (action.type === 'meld_declared') {
    const resolvedMeld = findAuthoritativeMeld(seatState.melds, action);
    if (!resolvedMeld) return null;
    const { meld, meldIndex } = resolvedMeld;
    const animatedTiles = action.kanType === 'kakan'
      ? meld.tiles.map((tile, tileIndex) => ({ tile, tileIndex })).filter(({ tile }) => tile.stacked)
      : meld.tiles.map((tile, tileIndex) => ({ tile, tileIndex }));
    if (animatedTiles.length === 0) return null;
    const meldTransforms = getMeldTileTransforms(seat, seatState.melds);
    const transientTiles = animatedTiles.map(({ tile, tileIndex }, proxyIndex) => {
      const sourceTransform = getHandTileTransform(
        seat,
        proxyIndex,
        animatedTiles.length,
        false,
      );
      const destinationTransform = meldTransforms[meldIndex][tileIndex];
      return {
        key: tile.key,
        tile: tile.tile,
        faceState: tile.faceState,
        orientation: tile.orientation,
        source: sourceTransform.position,
        destination: destinationTransform.position,
        sourceRotationX: sourceTransform.rotationX,
        sourceRotationY: sourceTransform.rotationY,
        destinationRotationX: destinationTransform.rotationX,
        destinationRotationY: destinationTransform.rotationY,
        sourceScale: getHandTileScale(seat),
        destinationScale: TABLE_PRESENTATION_TUNING.tileScale.meld,
      } satisfies TransientTile3DPlan;
    });
    const source = averagePoint(transientTiles.map((tile) => tile.source));
    const destination = averagePoint(transientTiles.map((tile) => tile.destination));
    return {
      action,
      seat,
      entry: outwardPoint(seat, source, ENTRY_DISTANCE),
      source,
      destination,
      sourceRotationX: 0,
      sourceRotationY: getSeatDirectionRotation(seat),
      destinationRotationX: 0,
      destinationRotationY: getSeatDirectionRotation(seat),
      sourceScale: 1,
      destinationScale: 1,
      faceState: 'face-up',
      showPrimaryTile: false,
      transientTiles,
      hiddenMeldTileKeys: transientTiles.map((tile) => tile.key),
      localDomDraw: false,
    };
  }

  const riverTile = seatState.river.find((tile) => tile.riverIndex === action.riverIndex && tile.visible);
  if (!riverTile) return null;
  const destinationTransform = getRiverTileTransforms(seat, seatState.river)
    .get(riverTile.layoutIndex);
  if (!destinationTransform) return null;
  const captured = sourceStore.consume(action, sessionKey);
  const handSnapshot = createHandPresentationSnapshot(action, seat === 'bottom');
  const fallback = handSnapshot ? getHandTileTransform(seat, handSnapshot.discardVisualSlot,
    handSnapshot.visualHand.length, handSnapshot.drawnTile !== null)
    : getFallbackHandSource(seat, seatState.hand.length);
  const source = captured?.position ?? fallback.position;
  return {
    action,
    seat,
    entry: outwardPoint(seat, source, ENTRY_DISTANCE),
    handSnapshot: handSnapshot ?? undefined,
    source,
    destination: destinationTransform.position,
    sourceRotationX: captured?.rotationX ?? fallback.rotationX,
    sourceRotationY: captured?.rotationY ?? fallback.rotationY,
    destinationRotationX: 0,
    destinationRotationY: getRiverTileRotationY(seat, riverTile.orientation),
    sourceScale: getHandTileScale(seat),
    destinationScale: TABLE_PRESENTATION_TUNING.tileScale.river,
    tile: riverTile.tile ?? action.tile,
    faceState: 'face-up',
    showPrimaryTile: true,
    hiddenRiverKey: riverTile.key,
    localDomDraw: false,
  };
}

export function resolveTransientTile3DMotion(
  tile: TransientTile3DPlan,
  phase: HandAnimationPhase,
  progress: number,
) {
  const t = easeInOut(clamp01(progress));
  if (phase === 'approach') {
    return { position: tile.source, rotationX: tile.sourceRotationX, rotationY: tile.sourceRotationY, tileScale: tile.sourceScale, visible: false };
  }
  if (phase === 'grasp') {
    return groundTransientTileMotion({ position: addY(tile.source, TILE_LIFT * t), rotationX: tile.sourceRotationX, rotationY: tile.sourceRotationY, tileScale: tile.sourceScale, visible: true });
  }
  if (phase === 'travel') {
    const travel = lerpPoint(tile.source, tile.destination, t);
    const tileScale = lerp(tile.sourceScale, tile.destinationScale, t);
    return groundTransientTileMotion({
      position: addY(travel, Math.sin(Math.PI * t) * 0.22 + TILE_LIFT * (1 - t)),
      rotationX: lerp(tile.sourceRotationX, tile.destinationRotationX, t),
      rotationY: lerpAngle(tile.sourceRotationY, tile.destinationRotationY, t),
      tileScale,
      visible: true,
    });
  }
  if (phase === 'release') {
    return groundTransientTileMotion({
      position: addY(tile.destination, TILE_LIFT * (1 - t)),
      rotationX: tile.destinationRotationX,
      rotationY: tile.destinationRotationY,
      tileScale: tile.destinationScale,
      visible: true,
    });
  }
  return { position: tile.destination, rotationX: tile.destinationRotationX, rotationY: tile.destinationRotationY, tileScale: tile.destinationScale, visible: false };
}

export function resolveTableAnimation3DMotion(
  plan: TableAnimation3DPlan,
  phase: HandAnimationPhase,
  progress: number,
): TableAnimation3DMotion {
  const t = easeInOut(clamp01(progress));
  const draw = plan.action.type === 'tile_drawn';
  let handPosition: WorldPoint3D;
  let tilePosition: WorldPoint3D;
  let tileRotationX = plan.sourceRotationX;
  let tileRotationY = plan.sourceRotationY;
  let tileScale = plan.sourceScale;
  let tileVisible = true;

  if (phase === 'approach') {
    handPosition = lerpPoint(plan.entry, plan.source, t);
    tilePosition = draw ? handPosition : plan.source;
  } else if (phase === 'grasp') {
    handPosition = plan.source;
    tilePosition = addY(plan.source, TILE_LIFT * t);
  } else if (phase === 'travel') {
    const travel = lerpPoint(plan.source, plan.destination, t);
    const arc = Math.sin(Math.PI * t) * 0.22 + TILE_LIFT * (1 - t);
    handPosition = addY(travel, arc);
    tilePosition = addY(travel, arc);
    tileRotationX = lerp(plan.sourceRotationX, plan.destinationRotationX, t);
    tileRotationY = lerpAngle(plan.sourceRotationY, plan.destinationRotationY, t);
    tileScale = lerp(plan.sourceScale, plan.destinationScale, t);
  } else if (phase === 'release') {
    handPosition = addY(plan.destination, TILE_LIFT * (1 - t));
    // Snapshot carry already reaches the river; settle must not lift it a second time.
    tilePosition = plan.handSnapshot ? plan.destination : addY(plan.destination, TILE_LIFT * (1 - t));
    tileRotationX = plan.destinationRotationX;
    tileRotationY = plan.destinationRotationY;
    tileScale = plan.destinationScale;
  } else {
    handPosition = lerpPoint(plan.destination, plan.entry, t);
    tilePosition = plan.destination;
    tileRotationX = plan.destinationRotationX;
    tileRotationY = plan.destinationRotationY;
    tileScale = plan.destinationScale;
    tileVisible = false;
  }

  return {
    handPosition,
    tilePosition: groundTilePosition(tilePosition, tileRotationX, tileScale),
    tileRotationX,
    tileRotationY,
    tileScale,
    tileVisible,
  };
}

function groundTransientTileMotion<T extends Readonly<{
  position: WorldPoint3D;
  rotationX: number;
  tileScale: number;
}>>(motion: T): T {
  return {
    ...motion,
    position: groundTilePosition(motion.position, motion.rotationX, motion.tileScale),
  };
}

function groundTilePosition(
  position: WorldPoint3D,
  rotationX: number,
  scale = 1,
): WorldPoint3D {
  const groundedCenterY = getGroundedTileCenterY(rotationX, scale);
  return position[1] >= groundedCenterY
    ? position
    : [position[0], groundedCenterY, position[2]];
}

function getFallbackHandSource(seat: Table3DSeat, handCount: number) {
  const count = Math.max(1, handCount);
  return getHandTileTransform(seat, count - 1, count, false);
}

function findAuthoritativeMeld(
  melds: readonly MeldSceneState[],
  action: MeldDeclaredPresentationEvent,
): { meld: MeldSceneState; meldIndex: number } | null {
  const expectedType = action.meldType === 'kan' ? action.kanType : action.meldType;
  for (let meldIndex = melds.length - 1; meldIndex >= 0; meldIndex -= 1) {
    const meld = melds[meldIndex];
    if (expectedType ? meld.callType === expectedType : isKanType(meld.callType)) {
      return { meld, meldIndex };
    }
  }
  return null;
}

function isKanType(callType: MeldSceneState['callType']): boolean {
  return callType === 'ankan' || callType === 'minkan' || callType === 'kakan';
}

function averagePoint(points: readonly WorldPoint3D[]): WorldPoint3D {
  const total = points.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]] as WorldPoint3D,
    [0, 0, 0] as WorldPoint3D,
  );
  return [total[0] / points.length, total[1] / points.length, total[2] / points.length];
}

function getSeatDirectionRotation(seat: Table3DSeat): number {
  return getHandTileTransform(seat, 0, 1, false).rotationY;
}

function findSeat(sceneState: TableSceneState, playerId: number): Table3DSeat | null {
  return (Object.keys(sceneState.seats) as Table3DSeat[])
    .find((seat) => sceneState.seats[seat].playerId === playerId) ?? null;
}

function outwardPoint(seat: Table3DSeat, point: WorldPoint3D, distance: number): WorldPoint3D {
  const direction = getSeatDirection(seat);
  return [point[0] - direction.x * distance, point[1], point[2] - direction.z * distance];
}

function lerpPoint(from: WorldPoint3D, to: WorldPoint3D, amount: number): WorldPoint3D {
  return [
    lerp(from[0], to[0], amount),
    lerp(from[1], to[1], amount),
    lerp(from[2], to[2], amount),
  ];
}

function addY(point: WorldPoint3D, amount: number): WorldPoint3D {
  return [point[0], point[1] + amount, point[2]];
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function lerpAngle(from: number, to: number, amount: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeInOut(value: number): number {
  return value * value * (3 - 2 * value);
}

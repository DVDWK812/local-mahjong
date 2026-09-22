import { TABLE_WORLD_DIMENSIONS } from '../table/TableMesh';
import { TABLE_FELT_TOP_Y } from '../table/tableSurfaceSpec';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { getSeatDirection } from '../coordinates/seatTransforms';
import { candidateRowSlots } from './candidateRows';
import { MAHJONG_TILE_DIMENSIONS } from '../tile/tileGeometry';
import { getFlatTileCenterY, getStandingTileCenterY } from '../tile/tileGrounding';
import type { TableParticipant, VisibleTile } from './participantPresentation';
import { TABLE_CAMERA } from '../camera/FixedTableCamera';
import { getHandTileTransform, getRiverTileTransforms, getRiverTileRotationY, TABLE_SCENE_LAYOUT } from '../coordinates/sceneTransforms';
import { getHandTileScale, TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';

export type ParticipantLayoutPreset = 'duel' | 'three-preview';
export type ParticipantSeat = Readonly<{ participantId: string; seat: Table3DSeat }>;
type Point = readonly [number, number, number];
type SeatLayout = Readonly<{ hand: Point; river: Point; rotation: number; hud: readonly [number, number] }>;
export type ParticipantRiverViewport = Readonly<{ width: number; height: number }>;

// The shared four-player river remains the authority for normal counts and 1080p.
// At 720p the duel's first row reaches the HUD and later rows reach the avatar.
export const SEVENTEEN_COMPACT_RIVER = {
  maxCanvasHeight: 800,
  firstCompactTileCount: 13,
  scale: 0.9,
  radial: 0.55,
  laterRowInline: 2.7,
} as const;
// Independent mode values. Never mutate the standard four-player tuning.
export const PARTICIPANT_LAYOUTS: Record<ParticipantLayoutPreset, Readonly<{
  seats: readonly Table3DSeat[]; columns: number; camera: Point; target: Point;
  placements: Partial<Record<Table3DSeat, SeatLayout>>;
}>> = {
  duel: { seats: ['bottom', 'top'], columns: TABLE_SCENE_LAYOUT.riverColumns, camera: TABLE_CAMERA.position, target: TABLE_CAMERA.target, placements: {} },
  'three-preview': { seats: ['bottom', 'right', 'left'], columns: 6, camera: [0, 43, 32], target: [0, 0.7, 1], placements: {
    bottom: { hand: [0, 0, 14], river: [-3.3, 0, 6], rotation: 0, hud: [50, 91] },
    right: { hand: [14, 0, -2], river: [9, 0, -4], rotation: -Math.PI / 2, hud: [89, 30] },
    left: { hand: [-14, 0, -2], river: [-9, 0, 2.6], rotation: Math.PI / 2, hud: [11, 30] },
  } },
};
export function resolveParticipantLayout(participants: readonly TableParticipant[], mapping: readonly ParticipantSeat[], preset: ParticipantLayoutPreset) {
  const config = PARTICIPANT_LAYOUTS[preset];
  if (participants.length !== mapping.length || new Set(participants.map(p => p.id)).size !== participants.length
    || new Set(mapping.map(m => m.participantId)).size !== mapping.length || new Set(mapping.map(m => m.seat)).size !== mapping.length
    || mapping.some(m => !config.seats.includes(m.seat) || !participants.some(p => p.id === m.participantId))) throw new Error('参与者与显示席位映射无效。');
  return mapping.map(entry => ({ participant: participants.find(p => p.id === entry.participantId)!, seat: entry.seat, layout: config.placements[entry.seat]! }));
}
function offset(origin: Point, x: number, z: number, angle: number, y: number): Point {
  return [origin[0] + x * Math.cos(angle) + z * Math.sin(angle), y, origin[2] - x * Math.sin(angle) + z * Math.cos(angle)];
}
export function participantRiverTarget(preset: 'duel', seat: Table3DSeat, index: number, tiles?: readonly VisibleTile[], viewport?: ParticipantRiverViewport): { position: Point; rotationY: number; rotationX: number; tileScale: number };
export function participantRiverTarget(preset: ParticipantLayoutPreset, seat: Table3DSeat, index: number, tiles?: readonly VisibleTile[], viewport?: ParticipantRiverViewport): { position: Point; rotationY: number; rotationX?: number; tileScale?: number };
export function participantRiverTarget(preset: ParticipantLayoutPreset, seat: Table3DSeat, index: number, tiles: readonly VisibleTile[] = [], viewport?: ParticipantRiverViewport) {
  const config = PARTICIPANT_LAYOUTS[preset];
  if (preset === 'duel') {
    if (!config.seats.includes(seat) || index < 0 || !Number.isInteger(index)) throw new Error('无效的牌河位置。');
    const inputs = Array.from({ length: Math.max(index + 1, tiles.length) }, (_, layoutIndex) => ({ layoutIndex, orientation: tiles[layoutIndex]?.isRiichiDiscard ? 'sideways' as const : 'upright' as const }));
    const transform = getRiverTileTransforms(seat, inputs).get(index)!;
    const rotationY = getRiverTileRotationY(seat, inputs[index].orientation);
    const baselineScale = TABLE_PRESENTATION_TUNING.tileScale.river;
    if (!viewport || viewport.height > SEVENTEEN_COMPACT_RIVER.maxCanvasHeight || tiles.length < SEVENTEEN_COMPACT_RIVER.firstCompactTileCount) {
      return { ...transform, rotationY, tileScale: baselineScale };
    }
    const mirror = seat === 'bottom' ? 1 : -1;
    const tileScale = baselineScale * SEVENTEEN_COMPACT_RIVER.scale;
    return { ...transform, position: [
      transform.position[0] + (index >= config.columns ? SEVENTEEN_COMPACT_RIVER.laterRowInline * mirror : 0),
      getFlatTileCenterY(tileScale),
      transform.position[2] + SEVENTEEN_COMPACT_RIVER.radial * mirror,
    ] as const, rotationY, tileScale };
  }
  const layout = config.placements[seat];
  if (!layout || index < 0 || !Number.isInteger(index)) throw new Error('无效的牌河位置。');
  const rowStart = Math.floor(index / config.columns) * config.columns;
  let x = 0;
  for (let i = rowStart; i < index; i++) x += tiles[i]?.isRiichiDiscard ? 1.72 : 1.32;
  return { position: offset(layout.river, x, Math.floor(index / config.columns) * 1.72, layout.rotation, getFlatTileCenterY()), rotationY: layout.rotation + (tiles[index]?.isRiichiDiscard ? Math.PI / 2 : 0) };
}
export function interpolateParticipantRiverTarget(from: { position: Point; tileScale: number }, to: { position: Point; tileScale: number }, progress: number) {
  const amount = Math.max(0, Math.min(1, progress));
  return { position: [
    from.position[0] + (to.position[0] - from.position[0]) * amount,
    from.position[1] + (to.position[1] - from.position[1]) * amount,
    from.position[2] + (to.position[2] - from.position[2]) * amount,
  ] as const,
    tileScale: from.tileScale + (to.tileScale - from.tileScale) * amount };
}
export function participantHandTarget(preset: ParticipantLayoutPreset, seat: Table3DSeat, index: number, count: number) {
  if (preset === 'duel') return { ...getHandTileTransform(seat, index, count, false), tileScale: getHandTileScale(seat) };
  const layout = PARTICIPANT_LAYOUTS[preset].placements[seat]!;
  return { position: offset(layout.hand, (index - (count - 1) / 2) * 1.12, 0, layout.rotation, getStandingTileCenterY()), rotationY: layout.rotation, rotationX: -Math.PI / 2 };
}
/** C source contract: the caller must pass the actual candidate container, never a fixed hand. */
export function candidateSourceSlot(container: HTMLElement, instanceId: string) {
  const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-candidate-instance]'));
  const index = elements.findIndex(element => element.dataset.candidateInstance === instanceId);
  return index < 0 ? null : { instanceId, index, rect: (elements[index].querySelector('.tile') ?? elements[index]).getBoundingClientRect() };
}

/** Concealed candidate pool source beyond the top table edge, never the fixed hand. */
export const concealedCandidateSource = () => [0, TABLE_FELT_TOP_Y + 3, -TABLE_WORLD_DIMENSIONS.depth / 2 - 2] as const;

/** Anonymous candidate slots; fixed eleven-column anchors do not recenter as count falls. */
export function concealedCandidateTargets(count: number, seat: 'bottom' | 'top') {
  return candidateRowSlots(count, seat).map(slot => {
    const base = participantHandTarget('duel', seat, slot.column - 1, 11);
    const direction = getSeatDirection(seat);
    const spacing = (MAHJONG_TILE_DIMENSIONS.depth + 0.12) * getHandTileScale(seat);
    const radial = slot.outer ? -spacing : 0;
    return { ...base, ...slot, tileScale: getHandTileScale(seat), position: [base.position[0] + direction.x * radial,
      base.position[1], base.position[2] + direction.z * radial] as const };
  });
}

import { describe, expect, it } from 'vitest';
import { TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import { getRiverTileTransforms } from '../coordinates/sceneTransforms';
import { interpolateParticipantRiverTarget, participantRiverTarget, SEVENTEEN_COMPACT_RIVER } from './participantLayout';
import { createSeventeenPresentationFixture } from '../../dev/seventeenPresentationFixtures';
import { PerspectiveCamera, Vector3 } from 'three';
import { TABLE_CAMERA } from '../camera/FixedTableCamera';
import { candidatePlan } from './CandidateDiscard3D';
import type { CandidateFrame } from './candidateAnimation';
import { DEFAULT_HAND_PACK } from '../../hand/handPacks';

const fixture = createSeventeenPresentationFixture('last-turn');
const river = [...fixture.players[0].discardedTiles, fixture.players[0].discardCandidates[0]];
const small = { width: 1247, height: 666 };
const large = { width: 1875, height: 1015 };

describe('17-step high-count river clearance', () => {
  it('keeps 1–12 tiles at the shared four-player baseline and only compacts 13–17 at 720p', () => {
    for (const seat of ['bottom', 'top'] as const) {
      for (const count of [1, 6, 12]) {
        const tiles = river.slice(0, count);
        for (let index = 0; index < count; index++) {
          expect(participantRiverTarget('duel', seat, index, tiles, small))
            .toEqual(participantRiverTarget('duel', seat, index, tiles, large));
        }
      }
      for (const count of [13, 14, 15, 16, 17]) {
        const tiles = river.slice(0, count);
        const compact = participantRiverTarget('duel', seat, count - 1, tiles, small);
        const standard = participantRiverTarget('duel', seat, count - 1, tiles, large);
        expect(compact.tileScale).toBe(TABLE_PRESENTATION_TUNING.tileScale.river * SEVENTEEN_COMPACT_RIVER.scale);
        expect(standard.tileScale).toBe(TABLE_PRESENTATION_TUNING.tileScale.river);
        expect(compact.position).not.toEqual(standard.position);
      }
    }
  });

  it('mirrors bottom/top clearance without changing the shared river layout authority', () => {
    const before = getRiverTileTransforms('bottom', river.map((_, layoutIndex) => ({ layoutIndex, orientation: 'upright' as const }))).get(16);
    for (const index of [0, 5, 6, 12, 16]) {
      const bottom = participantRiverTarget('duel', 'bottom', index, river, small);
      const top = participantRiverTarget('duel', 'top', index, river, small);
      const bottomBase = participantRiverTarget('duel', 'bottom', index, river, large);
      const topBase = participantRiverTarget('duel', 'top', index, river, large);
      expect(bottom.tileScale).toBe(top.tileScale);
      expect(bottom.position[0] - bottomBase.position[0]).toBeCloseTo(-(top.position[0] - topBase.position[0]));
      expect(bottom.position[2] - bottomBase.position[2]).toBeCloseTo(-(top.position[2] - topBase.position[2]));
    }
    expect(getRiverTileTransforms('bottom', river.map((_, layoutIndex) => ({ layoutIndex, orientation: 'upright' as const }))).get(16)).toEqual(before);
  });

  it('keeps all 17 compact tile centers clear of the audited 720p HUD and avatar footprints', () => {
    const canvas = { left: 16.17, top: 49.64, width: 1246.82, height: 665.53 };
    const zones = [
      [514.54, 255.2, 758.8, 443.12], // visible center HUD
      [521.3, 498.38, 586.13, 596.97], // bottom avatar
      [957.17, 67.83, 1022, 166.43], // top avatar
    ];
    const camera = new PerspectiveCamera(TABLE_CAMERA.fov, canvas.width / canvas.height, TABLE_CAMERA.near, TABLE_CAMERA.far);
    camera.position.set(...TABLE_CAMERA.position);
    camera.lookAt(...TABLE_CAMERA.target);
    camera.updateMatrixWorld();
    for (const seat of ['bottom', 'top'] as const) {
      for (let index = 0; index < 17; index++) {
        const target = participantRiverTarget('duel', seat, index, river, small);
        const projected = new Vector3(...target.position).project(camera);
        const x = canvas.left + (projected.x + 1) * canvas.width / 2;
        const y = canvas.top + (1 - projected.y) * canvas.height / 2;
        // Conservative screen-space body envelope; the real WebGL box check is in QA.
        expect(zones.some(([left, top, right, bottom]) => x > left - 18 && x < right + 18 && y > top - 17 && y < bottom + 17))
          .toBe(false);
      }
    }
  });

  it('shares the final target with the proxy and interpolates the old 12 during retreat', () => {
    const oldRiver = river.slice(0, 12);
    const finalRiver = river.slice(0, 13);
    const old = participantRiverTarget('duel', 'bottom', 0, oldRiver, small);
    const end = participantRiverTarget('duel', 'bottom', 0, finalRiver, small);
    const staticTarget = participantRiverTarget('duel', 'bottom', 12, finalRiver, small);
    const camera = new PerspectiveCamera(TABLE_CAMERA.fov, 1247 / 666, TABLE_CAMERA.near, TABLE_CAMERA.far);
    camera.position.set(...TABLE_CAMERA.position);
    camera.lookAt(...TABLE_CAMERA.target);
    camera.updateMatrixWorld();
    const tile = finalRiver[12];
    const frame: CandidateFrame = {
      snapshot: { session: 'compact', playerId: 0, tile, riverIndex: 12, river: finalRiver,
        candidates: [tile], source: { instanceId: tile.instanceId, row: 1, column: 1,
          rect: { left: 420, top: 590, width: 37, height: 52 } }, pack: DEFAULT_HAND_PACK },
      event: { eventId: 'compact:13', sequence: 1, type: 'tile_discarded', playerId: 0,
        tile, riverIndex: 12, isRiichiDiscard: false },
      phase: 'travel', progress: 1,
    };
    const proxy = candidatePlan(frame, camera, { left: 0, top: 0, ...small });
    expect(proxy?.destination).toEqual(staticTarget.position);
    expect(proxy?.destinationScale).toBe(staticTarget.tileScale);
    expect(interpolateParticipantRiverTarget(old, end, 0)).toEqual({ position: old.position, tileScale: old.tileScale });
    expect(interpolateParticipantRiverTarget(old, end, 1)).toEqual({ position: end.position, tileScale: end.tileScale });
    const midpoint = interpolateParticipantRiverTarget(old, end, 0.5);
    expect(midpoint.position[2]).toBeGreaterThan(old.position[2]);
    expect(midpoint.position[2]).toBeLessThan(end.position[2]);
  });
});

import type { OccupiedTableSceneState } from '../sceneState/tableSceneTypes';
import { getHandTileTransform, getMeldTileTransform, getRiverTileTransform } from '../coordinates/sceneTransforms';
import { northTileTransform } from '../meld/NorthTiles3D';
import type { SanmaUiTuning, SanmaScreenSeat } from './sanmaUiTuningTypes';

/** Called only by the sanma controller, after semantic projection; never mutates state/config. */
export function applySanmaUiTuning(scene: OccupiedTableSceneState, tuning: SanmaUiTuning): OccupiedTableSceneState {
  return { ...scene, scoreHudTuning: tuning.center.scoreHud, seats: Object.fromEntries(
    (['bottom', 'right', 'top'] as const).flatMap((seat: SanmaScreenSeat) => {
      const state = scene.seats[seat];
      if (!state) return [];
      const config = tuning.seats[seat];
      return [[seat, { ...state, northLane: tuning.northLane, regionTuning: {
        hand: seat === 'bottom' ? undefined : { offset: tuning.seats[seat].hand, pivot: getHandTileTransform(seat, 0, 1, false).position },
        river: { offset: config.river, pivot: getRiverTileTransform(seat, 0).position },
        melds: { offset: config.melds, pivot: getMeldTileTransform(seat, 0, 0).position },
        nuki: { offset: config.nuki, pivot: northTileTransform(seat, 0, tuning.northLane).position },
      } }]];
    }),
  ) };
}

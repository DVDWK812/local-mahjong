import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Texture } from 'three';
import { createInitialGameState } from '../../game/engine';
import { buildTableSceneState } from '../sceneState/buildTableSceneState';
import { Hand3D } from '../hand/Hand3D';
import { River3D } from '../river/River3D';
import { Meld3D } from '../meld/Meld3D';
import { Wall3D } from '../wall/Wall3D';
import { RiichiSticks3D } from '../riichi/RiichiSticks3D';
import { HandAction3D } from '../animation/HandAction3D';
import { resolveTableAnimation3DPlan } from '../animation/tableAnimation3D';
import { DiscardSource3DStore } from '../animation/DiscardSource3D';
import { TileAppearance3DContext } from './TileAppearance3DContext';
import { DEFAULT_RIICHI_STICK_3D_APPEARANCE } from '../riichi/riichiStickAppearance';

const seen = vi.hoisted(() => ({ tiles: [] as Array<{ ownerPlayerId?: number }>, sticks: [] as Array<{ appearance?: { texture?: unknown } }> }));
vi.mock('../tile/Tile3D', () => ({ Tile3D: (props: { ownerPlayerId?: number }) => { seen.tiles.push(props); return null; } }));
vi.mock('../animation/HandProxy3D', () => ({ HandProxy3D: () => null }));
vi.mock('@react-three/fiber', () => ({ useThree: (select: (s: unknown) => unknown) => select({ gl: { domElement: { style: {} } }, invalidate: () => undefined }), useFrame: () => undefined }));
vi.mock('../riichi/RiichiStick3D', async importOriginal => {
  const original = await importOriginal<typeof import('../riichi/RiichiStick3D')>();
  return { ...original, RiichiStick3D: (props: { appearance?: { texture?: unknown } }) => { seen.sticks.push(props); return null; } };
});

describe('real 3D consumer owner contracts', () => {
  it('Hand/River/Meld including hidden kan follow player ID through every rotation; Wall is unowned', () => {
    const state = createInitialGameState(); const before = JSON.stringify(state);
    for (const bottomPlayerId of [0, 1, 2, 3] as const) {
      const scene = buildTableSceneState(state, { bottomPlayerId });
      for (const seat of Object.values(scene.seats)) {
        const tiles = seat.hand.slice(0, 4);
        const filled = { ...seat, river: tiles.map((tile, i) => ({ ...tile, riverIndex: i, layoutIndex: i, claimed: false, visible: true })),
          melds: [{ key: 'kan', callType: 'ankan' as const, tiles: tiles.map(tile => ({ ...tile, faceState: 'face-down' as const, called: false, stacked: false })) }] };
        for (const consumer of [<Hand3D seatState={filled} />, <River3D seatState={filled} />, <Meld3D seatState={filled} />]) {
          seen.tiles.length = 0; renderToStaticMarkup(consumer);
          expect(seen.tiles.length).toBeGreaterThan(0);
          expect(seen.tiles.every(tile => tile.ownerPlayerId === seat.playerId)).toBe(true);
        }
      }
      seen.tiles.length = 0; renderToStaticMarkup(<Wall3D sceneState={scene} />);
      expect(seen.tiles.length).toBeGreaterThan(0); expect(seen.tiles.every(tile => tile.ownerPlayerId === undefined)).toBe(true);
    }
    expect(JSON.stringify(state)).toBe(before);
  });
  it('riichi animation/release and static sticks consume the same actor texture for all four players', () => {
    const textures = [new Texture(), new Texture(), new Texture(), new Texture()];
    const resources = { players: Object.fromEntries(textures.map((texture, id) => [id, { riichiStickAppearance: { ...DEFAULT_RIICHI_STICK_3D_APPEARANCE, texture } }])) };
    for (const bottomPlayerId of [0, 1, 2, 3] as const) {
      const scene = buildTableSceneState(createInitialGameState(), { bottomPlayerId });
      const declared = { ...scene, seats: { ...scene.seats } };
      for (const seat of Object.values(scene.seats)) declared.seats[seat.seat] = { ...seat, riichi: true };
      seen.sticks.length = 0;
      renderToStaticMarkup(<TileAppearance3DContext.Provider value={resources}><RiichiSticks3D sceneState={declared} /></TileAppearance3DContext.Provider>);
      expect(seen.sticks.map(s => s.appearance?.texture)).toEqual(Object.values(declared.seats).map(s => textures[s.playerId]));
      for (const playerId of [0, 1, 2, 3] as const) {
        const plan = resolveTableAnimation3DPlan({ type: 'riichi_declared', playerId, riverIndex: 0, sequence: 1, eventId: `riichi-${playerId}` }, declared, new DiscardSource3DStore(), 'test');
        expect(plan).not.toBeNull();
        for (const phase of ['travel', 'release', 'retreat'] as const) {
          seen.sticks.length = 0;
          renderToStaticMarkup(<TileAppearance3DContext.Provider value={resources}><HandAction3D active={{ plan: plan!, phase }} /></TileAppearance3DContext.Provider>);
          expect(seen.sticks[0].appearance?.texture).toBe(textures[playerId]);
        }
      }
    }
  });
});

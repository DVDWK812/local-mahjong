import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { getTileRank, getTileSuit } from '../../game/tileUtils';
import type { CallSet, GameState, PlayerId, Tile, TileId } from '../../game/types';
import { getMeldTileTransforms } from '../coordinates/sceneTransforms';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { buildTableSceneState } from './buildTableSceneState';

function tile(id: TileId, instanceId: string, extras: Partial<Tile> = {}): Tile {
  return {
    id,
    suit: getTileSuit(id),
    rank: getTileRank(id),
    red: false,
    instanceId,
    ...extras,
  };
}

function withPlayer(state: GameState, playerId: PlayerId, update: Partial<GameState['players'][number]>): GameState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId
      ? { ...player, ...update }
      : player),
  };
}

const PLAYER_SEATS: Record<PlayerId, Table3DSeat> = {
  0: 'bottom',
  1: 'right',
  2: 'top',
  3: 'left',
};

function callerLocalInline(seat: Table3DSeat, position: readonly [number, number, number]): number {
  const rotationY = { bottom: 0, right: Math.PI / 2, top: Math.PI, left: -Math.PI / 2 }[seat];
  return position[0] * Math.cos(rotationY) - position[2] * Math.sin(rotationY);
}

describe('UI-5C GameState to TableSceneState adapter', () => {
  it('maps the initial authoritative counts without retaining GameState', () => {
    const gameState = createInitialGameState();
    const scene = buildTableSceneState(gameState);

    expect(scene.seats.bottom.hand).toHaveLength(14);
    expect(scene.seats.right.hand).toHaveLength(13);
    expect(scene.seats.top.hand).toHaveLength(13);
    expect(scene.seats.left.hand).toHaveLength(13);
    expect(scene.wall).toHaveLength(69);
    expect(scene.deadWall).toHaveLength(14);
    expect(scene.doraIndicators).toHaveLength(1);
    expect(scene).not.toHaveProperty('gameState');
  });

  it('never projects opponent tile identities unless the existing visibility option allows it', () => {
    const gameState = createInitialGameState();
    const hidden = buildTableSceneState(gameState, { bottomPlayerId: 2 });
    expect(hidden.seats.bottom.playerId).toBe(2);
    expect(hidden.seats.bottom.hand.every((entry) => entry.tile !== undefined)).toBe(true);
    expect(hidden.seats.right.hand.every((entry) => entry.tile === undefined)).toBe(true);
    expect(hidden.seats.top.hand.every((entry) => entry.tile === undefined)).toBe(true);
    expect(hidden.seats.left.hand.every((entry) => entry.tile === undefined)).toBe(true);

    const allOpen = buildTableSceneState(gameState, {
      bottomPlayerId: 2,
      revealOpponentHands: true,
    });
    expect(allOpen.seats.right.hand.every((entry) => entry.tile !== undefined)).toBe(true);

    const oneOpen = buildTableSceneState(gameState, {
      revealedPlayerId: 2,
    });
    expect(oneOpen.seats.top.hand.every((entry) => entry.tile !== undefined)).toBe(true);
    expect(oneOpen.seats.right.hand.every((entry) => entry.tile === undefined)).toBe(true);
  });

  it('preserves authoritative hand order, red-five state, and the separated drawn tile', () => {
    const gameState = createInitialGameState();
    const first = tile(0, 'hand-first');
    const redFive = tile(4, 'hand-red-five', { red: true });
    const drawn = tile(33, 'hand-drawn');
    const scene = buildTableSceneState(withPlayer(gameState, 0, {
      hand: [first, drawn, redFive],
      drawnTile: drawn,
    }));
    expect(scene.seats.bottom.hand.map((entry) => entry.key)).toEqual([
      'hand-0-hand-first',
      'hand-0-hand-red-five',
      'hand-0-hand-drawn',
    ]);
    expect(scene.seats.bottom.hand[1].tile).toEqual({
      id: 4,
      red: true,
      doraKind: 'tile--red-dora',
    });
    expect(scene.seats.bottom.hand[2].drawn).toBe(true);
  });

  it('maps authoritative Dora identity and red-five state without recomputing the indicator', () => {
    const gameState = createInitialGameState();
    const redDoraIndicator = tile(4, 'red-dora-indicator', { red: true });
    const scene = buildTableSceneState({
      ...gameState,
      doraIndicators: [redDoraIndicator],
    });

    expect(scene.doraIndicators).toEqual([{
      key: 'dora-red-dora-indicator',
      tile: { id: 4, red: true, doraKind: 'tile--red-dora' },
      faceState: 'face-up',
      orientation: 'upright',
    }]);
  });

  it('projects shared normal/red/combined Dora semantics into visible River tiles', () => {
    const gameState = createInitialGameState();
    const indicatorForFive = tile(3, 'indicator-four');
    const normalFive = tile(4, 'river-normal-five');
    const redFive = tile(4, 'river-red-five', { red: true });
    const scene = buildTableSceneState(withPlayer({
      ...gameState,
      doraIndicators: [indicatorForFive],
    }, 0, { river: [normalFive, redFive] }));

    expect(scene.seats.bottom.river[0].tile).toEqual({
      id: 4,
      red: false,
      doraKind: 'tile--dora',
    });
    expect(scene.seats.bottom.river[1].tile).toEqual({
      id: 4,
      red: true,
      doraKind: 'tile--double-dora',
    });
  });

  it('keeps discard order, riichi orientation, and claimed-discard gap semantics authoritative', () => {
    const gameState = createInitialGameState();
    const first = tile(0, 'river-first');
    const riichi = tile(1, 'river-riichi', { isRiichiDiscard: true });
    const claimed = tile(2, 'river-claimed', { claimed: true, claimedBy: 1 });
    const state = withPlayer(gameState, 0, {
      river: [first, riichi, claimed],
      riichi: true,
      riichiState: {
        declaredAtTurn: 2,
        ippatsuAvailable: false,
        kind: 'riichi',
        riichiDiscardInstanceId: riichi.instanceId,
      },
    });

    const compact = buildTableSceneState(state);
    expect(compact.seats.bottom.riichi).toBe(true);
    expect(compact.seats.bottom.river.map((entry) => entry.key)).toEqual([
      'river-0-river-first',
      'river-0-river-riichi',
    ]);
    expect(compact.seats.bottom.river[0].orientation).toBe('upright');
    expect(compact.seats.bottom.river[1].orientation).toBe('sideways');

    const preserved = buildTableSceneState(state, { preserveClaimedDiscardGap: true });
    expect(preserved.seats.bottom.river).toHaveLength(3);
    expect(preserved.seats.bottom.river[2]).toMatchObject({
      riverIndex: 2,
      layoutIndex: 2,
      claimed: true,
      visible: false,
      tile: undefined,
    });
  });

  it('maps chi, pon, ankan, minkan, and kakan through the existing meld display adapter', () => {
    const gameState = createInitialGameState();
    const chiTiles = [tile(0, 'chi-0'), tile(1, 'chi-1'), tile(2, 'chi-2')];
    const ponTiles = [tile(5, 'pon-0'), tile(5, 'pon-1'), tile(5, 'pon-2')];
    const ankanTiles = [tile(31, 'ankan-0'), tile(31, 'ankan-1'), tile(31, 'ankan-2'), tile(31, 'ankan-3')];
    const minkanTiles = [tile(8, 'minkan-0'), tile(8, 'minkan-1'), tile(8, 'minkan-2'), tile(8, 'minkan-3')];
    const kakanTiles = [tile(12, 'kakan-0'), tile(12, 'kakan-1'), tile(12, 'kakan-2'), tile(12, 'kakan-3')];
    const calls: CallSet[] = [
      { type: 'chi', tiles: chiTiles, from: 3, opened: true, sequence: [0, 1, 2], calledTile: chiTiles[0], usedTileIds: [1, 2] },
      { type: 'pon', tiles: ponTiles, from: 2, opened: true, calledTile: ponTiles[1] },
      { type: 'kan', kanType: 'ankan', tiles: ankanTiles, from: 0, opened: false },
      { type: 'kan', kanType: 'minkan', tiles: minkanTiles, from: 1, opened: true, calledTile: minkanTiles[3] },
      { type: 'kan', kanType: 'kakan', tiles: kakanTiles, from: 2, opened: true, calledTile: kakanTiles[1] },
    ];
    const scene = buildTableSceneState(withPlayer(gameState, 0, { calls }));

    expect(scene.seats.bottom.melds.map((meld) => meld.callType)).toEqual([
      'chi', 'pon', 'ankan', 'minkan', 'kakan',
    ]);
    expect(scene.seats.bottom.melds[2].tiles.map((entry) => entry.faceState)).toEqual([
      'face-down', 'face-up', 'face-up', 'face-down',
    ]);
    expect(scene.seats.bottom.melds[2].tiles[0].tile).toBeUndefined();
    expect(scene.seats.bottom.melds[4].tiles[3].stacked).toBe(true);
  });

  it('places pon and minkan called tiles by caller-local source for every caller seat', () => {
    const relations = [
      { name: 'left', offset: 3, expectedLocalSlot: 0 },
      { name: 'opposite', offset: 2, expectedLocalSlot: 1 },
      { name: 'right', offset: 1, expectedLocalSlot: -1 },
    ] as const;

    ([0, 1, 2, 3] as const).forEach((caller) => {
      relations.forEach(({ name, offset, expectedLocalSlot }) => {
        (['pon', 'minkan'] as const).forEach((kind) => {
          const calledFrom = ((caller + offset) % 4) as PlayerId;
          const tileCount = kind === 'pon' ? 3 : 4;
          const meldTiles = Array.from({ length: tileCount }, (_, index) => (
            tile(5, `${kind}-${caller}-${name}-${index}`)
          ));
          const calledTile = meldTiles[tileCount - 1];
          const call: CallSet = kind === 'pon'
            ? { type: 'pon', tiles: meldTiles, from: calledFrom, opened: true, calledTile }
            : { type: 'kan', kanType: 'minkan', tiles: meldTiles, from: calledFrom, opened: true, calledTile };
          const state = withPlayer(createInitialGameState(), caller, { calls: [call] });
          const seat = PLAYER_SEATS[caller];
          const meld = buildTableSceneState(state).seats[seat].melds[0];
          const transforms = getMeldTileTransforms(seat, [meld])[0];
          const localOrder = transforms
            .map((transform, index) => ({ index, inline: callerLocalInline(seat, transform.position) }))
            .sort((a, b) => a.inline - b.inline);
          const calledIndex = meld.tiles.findIndex((entry) => entry.called);
          const expectedIndex = expectedLocalSlot < 0 ? tileCount - 1 : expectedLocalSlot;

          expect(localOrder.findIndex((entry) => entry.index === calledIndex), `${kind} caller=${caller} source=${name}`)
            .toBe(expectedIndex);
        });
      });
    });
  });

  it('stacks kakan on the caller-local called tile for every caller and source', () => {
    const sourceOffsets = [3, 2, 1] as const;
    ([0, 1, 2, 3] as const).forEach((caller) => {
      sourceOffsets.forEach((offset) => {
        const calledFrom = ((caller + offset) % 4) as PlayerId;
        const meldTiles = Array.from({ length: 4 }, (_, index) => tile(12, `kakan-${caller}-${offset}-${index}`));
        const state = withPlayer(createInitialGameState(), caller, { calls: [{
          type: 'kan',
          kanType: 'kakan',
          tiles: meldTiles,
          from: calledFrom,
          opened: true,
          calledTile: meldTiles[0],
        }] });
        const seat = PLAYER_SEATS[caller];
        const meld = buildTableSceneState(state).seats[seat].melds[0];
        const transforms = getMeldTileTransforms(seat, [meld])[0];
        const calledIndex = meld.tiles.findIndex((entry) => entry.called);
        const stackedIndex = meld.tiles.findIndex((entry) => entry.stacked);

        expect(transforms[stackedIndex].position[0]).toBeCloseTo(transforms[calledIndex].position[0]);
        expect(transforms[stackedIndex].position[2]).toBeCloseTo(transforms[calledIndex].position[2]);
        expect(transforms[stackedIndex].position[1]).toBeGreaterThan(transforms[calledIndex].position[1]);
      });
    });
  });

  it('preserves the existing chi tile order and called-tile orientation', () => {
    const chiTiles = [tile(0, 'chi-order-0'), tile(1, 'chi-order-1'), tile(2, 'chi-order-2')];
    const state = withPlayer(createInitialGameState(), 0, { calls: [{
      type: 'chi',
      tiles: chiTiles,
      from: 3,
      opened: true,
      sequence: [0, 1, 2],
      calledTile: chiTiles[0],
      usedTileIds: [1, 2],
    }] });
    const meld = buildTableSceneState(state).seats.bottom.melds[0];

    expect(meld.tiles.map((entry) => entry.key)).toEqual([
      'meld-tile-0-chi-order-0',
      'meld-tile-0-chi-order-1',
      'meld-tile-0-chi-order-2',
    ]);
    expect(meld.tiles.map((entry) => entry.orientation)).toEqual(['sideways', 'upright', 'upright']);
  });

  it('tracks live-wall depletion, rinshan consumption, visible dora, and hidden ura slots', () => {
    const initial = createInitialGameState();
    const afterDraws = buildTableSceneState({ ...initial, wall: initial.wall.slice(3) });
    expect(afterDraws.wall).toHaveLength(66);
    expect(afterDraws.wall[0].slotIndex).toBe(3);

    const afterKanState: GameState = {
      ...initial,
      wall: initial.wall.slice(0, -1),
      doraIndicators: [initial.deadWall[4], initial.deadWall[6]],
    };
    const afterKan = buildTableSceneState(afterKanState);
    expect(afterKan.wall).toHaveLength(68);
    expect(afterKan.deadWall.find((entry) => entry.slotIndex === 0)?.visible).toBe(false);
    expect(afterKan.deadWall.find((entry) => entry.slotIndex === 6)).toMatchObject({
      faceState: 'face-up',
      role: 'dora-indicator',
    });
    expect(afterKan.deadWall.filter((entry) => entry.role === 'ura-dora-indicator')
      .every((entry) => entry.faceState === 'face-down' && entry.tile === undefined)).toBe(true);
  });

  it('never exposes hidden wall Aka identity but preserves revealed normal, Aka, and combined semantics', () => {
    const initial = createInitialGameState();
    const hiddenAka = tile(4, 'hidden-wall-aka', { red: true });
    const normalIndicator = tile(8, 'revealed-normal-indicator');
    const indicatorForFive = tile(3, 'indicator-for-five');
    const combinedIndicator = tile(4, 'revealed-combined-indicator', { red: true });
    const akaOnlyIndicator = tile(13, 'revealed-aka-only-indicator', { red: true });
    const deadWall = initial.deadWall.map((entry, index) => {
      if (index === 4) return combinedIndicator;
      if (index === 6) return normalIndicator;
      if (index === 8) return akaOnlyIndicator;
      return entry;
    });
    const scene = buildTableSceneState({
      ...initial,
      wall: [hiddenAka, ...initial.wall.slice(1)],
      deadWall,
      doraIndicators: [indicatorForFive, combinedIndicator, normalIndicator, akaOnlyIndicator],
    });

    expect(scene.wall[0]).toMatchObject({ faceState: 'face-down' });
    expect(scene.wall[0].tile).toBeUndefined();
    expect(scene.deadWall.find((entry) => entry.key === 'dead-wall-revealed-normal-indicator'))
      .toMatchObject({
        faceState: 'face-up',
        tile: { id: 8, red: false, doraKind: null },
      });
    expect(scene.deadWall.find((entry) => entry.key === 'dead-wall-revealed-combined-indicator'))
      .toMatchObject({
        faceState: 'face-up',
        tile: { id: 4, red: true, doraKind: 'tile--double-dora' },
      });
    expect(scene.deadWall.find((entry) => entry.key === 'dead-wall-revealed-aka-only-indicator'))
      .toMatchObject({
        faceState: 'face-up',
        tile: { id: 13, red: true, doraKind: 'tile--red-dora' },
      });
    expect(scene.deadWall.filter((entry) => entry.faceState === 'face-down')
      .every((entry) => entry.tile === undefined)).toBe(true);
  });

  it('keeps shared normal/red/combined semantics intact through visible Meld projection', () => {
    const initial = createInitialGameState();
    const indicatorForFive = tile(3, 'meld-indicator-four');
    const normalFiveA = tile(4, 'meld-normal-five-a');
    const redFive = tile(4, 'meld-red-five', { red: true });
    const normalFiveB = tile(4, 'meld-normal-five-b');
    const calls: CallSet[] = [{
      type: 'pon',
      tiles: [normalFiveA, redFive, normalFiveB],
      from: 2,
      opened: true,
      calledTile: redFive,
    }];
    const scene = buildTableSceneState(withPlayer({
      ...initial,
      doraIndicators: [indicatorForFive],
    }, 0, { calls }));

    expect(scene.seats.bottom.melds[0].tiles.map((entry) => entry.tile?.doraKind))
      .toEqual(['tile--dora', 'tile--double-dora', 'tile--dora']);
    expect(scene.seats.bottom.melds[0].tiles.map((entry) => entry.tile?.red))
      .toEqual([false, true, false]);
  });

  it('derives a fresh scene for each authoritative state update without stale river or hand data', () => {
    const initial = createInitialGameState();
    const discarded = initial.players[0].hand[0];
    const next = withPlayer(initial, 0, {
      hand: initial.players[0].hand.slice(1),
      river: [discarded],
      drawnTile: null,
    });
    const beforeScene = buildTableSceneState(initial);
    const afterScene = buildTableSceneState(next);
    expect(beforeScene.seats.bottom.hand).toHaveLength(14);
    expect(beforeScene.seats.bottom.river).toHaveLength(0);
    expect(afterScene.seats.bottom.hand).toHaveLength(13);
    expect(afterScene.seats.bottom.river[0].key).toBe(`river-0-${discarded.instanceId}`);
  });
});

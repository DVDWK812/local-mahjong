import { describe, expect, it } from 'vitest';
import { applyFinishedGameToMatch, startMatch } from './match/matchEngine';
import { createTile } from './tileUtils';
import type { CallSet, GameState, RoundResult } from './types';

describe('next round reset', () => {
  it('点击继续进入下一局时清理上一局临时牌局状态并保留整场点数信息', () => {
    const match = startMatch({ matchLength: 'hanchan' });
    const currentGame = match.currentGame as GameState;
    const oldRiverTile = createTile(0, 0);
    const oldCall: CallSet = {
      type: 'pon',
      tiles: [createTile(1, 0), createTile(1, 1), createTile(1, 2)],
      from: 2,
      opened: true,
      calledTile: createTile(1, 3),
    };
    const result: RoundResult = {
      type: 'ron',
      winners: [{
        winner: 1,
        from: 0,
        winType: 'ron',
        winTile: createTile(2, 0),
        yaku: [{ name: '断幺九', han: 1 }],
        han: 1,
        fu: 30,
        points: 1000,
        pointDeltas: [0, 0, 0, 0],
      }],
      pointDeltas: [0, 0, 0, 0],
    };
    const dirtyGame: GameState = {
      ...currentGame,
      result,
      doraIndicators: currentGame.deadWall.slice(0, 4),
      players: currentGame.players.map((player) => ({
        ...player,
        river: [oldRiverTile],
        calls: [oldCall],
        riichi: true,
        riichiState: { declaredAtTurn: 2, ippatsuAvailable: true, kind: 'riichi' },
        drawnTile: player.drawnTile,
      })),
      pendingCall: { discarder: 0, tile: oldRiverTile, options: [] },
      pendingRon: { discarder: 0, tile: oldRiverTile, eligibleRonPlayers: [1], passedPlayers: [] },
      pendingKakan: {
        declarer: 1,
        ponCallIndex: 0,
        addedTile: createTile(1, 3),
        addedTileInstanceId: 'old-kakan',
        eligibleRonPlayers: [],
        passedPlayers: [],
      },
      kanState: { type: 'ankan', player: 1, tile: 1, doraIndicatorCount: 4 },
    };

    const applied = applyFinishedGameToMatch(match, dirtyGame);
    const next = applied.nextGameState;
    expect(next).toBeDefined();
    expect(next?.players.every((player) => player.river.length === 0)).toBe(true);
    expect(next?.players.every((player) => player.calls.length === 0)).toBe(true);
    expect(next?.players.every((player) => !player.riichi && player.riichiState === null)).toBe(true);
    expect(next?.pendingCall).toBeNull();
    expect(next?.pendingRon).toBeNull();
    expect(next?.pendingKakan).toBeNull();
    expect(next?.kanState).toBeNull();
    expect(next?.result).toBeNull();
    expect(next?.doraIndicators).toHaveLength(1);
    expect(next?.players.map((player) => player.score)).toEqual(applied.match.scores);
  });
});

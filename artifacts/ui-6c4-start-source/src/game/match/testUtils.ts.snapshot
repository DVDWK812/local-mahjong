import { createTile } from '../tileUtils';
import type { AbortiveDrawReason, PlayerId, RoundResult } from '../types';

export function ronResult(winner: PlayerId, from: PlayerId, deltas: [number, number, number, number], roundId = `ron-${winner}-${from}-${deltas.join('.')}`): RoundResult {
  return {
    type: 'ron',
    winners: [{
      winner,
      from,
      winType: 'ron',
      winTile: createTile(1, 0),
      yaku: [{ name: 'test', han: 1 }],
      han: 1,
      fu: 30,
      points: Math.max(...deltas),
      pointDeltas: deltas,
    }],
    pointDeltas: deltas,
    roundId,
  } as RoundResult;
}

export function tsumoResult(winner: PlayerId, deltas: [number, number, number, number], roundId = `tsumo-${winner}-${deltas.join('.')}`): RoundResult {
  return {
    type: 'tsumo',
    winners: [{
      winner,
      from: null,
      winType: 'tsumo',
      winTile: createTile(1, 0),
      yaku: [{ name: 'test', han: 1 }],
      han: 1,
      fu: 30,
      points: Math.max(...deltas),
      pointDeltas: deltas,
    }],
    pointDeltas: deltas,
    roundId,
  } as RoundResult;
}

export function exhaustiveResult(tenpaiPlayers: PlayerId[], deltas: [number, number, number, number], dealerContinues: boolean, roundId = `draw-${tenpaiPlayers.join('.')}-${deltas.join('.')}`): RoundResult {
  return {
    type: 'exhaustive-draw',
    tenpaiPlayers,
    notenPlayers: ([0, 1, 2, 3] as PlayerId[]).filter((player) => !tenpaiPlayers.includes(player)),
    scoreDeltas: deltas,
    pointDeltas: deltas,
    dealerContinues,
    honbaIncrement: 1,
    riichiSticksCarryOver: true,
    roundId,
  } as RoundResult;
}

export function abortiveResult(reason: AbortiveDrawReason = 'kyuushu-kyuuhai', roundId = `abort-${reason}`): RoundResult {
  return {
    type: 'abortive-draw',
    reason,
    dealerContinues: true,
    honbaIncrement: 1,
    riichiSticksCarryOver: true,
    scoreDeltas: [0, 0, 0, 0],
    pointDeltas: [0, 0, 0, 0],
    roundId,
  } as RoundResult;
}

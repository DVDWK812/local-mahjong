import { evaluateWin, type WinContext } from './scoreCalculator';
import { createScoringWinContext } from './score/scoringAdapter';
import { buildAbortiveDrawResult } from './abortiveDraw';
import { defaultRuleConfig } from './score/rules/RuleConfig';
import type { GameState, PlayerId, RoundResult, Tile, WinResultEntry } from './types';
import type { WinningTileSource } from './score/scoringTypes';
import { defaultMatchRuleConfig } from './match/matchRules';
import { canRonWithFuritenCheck } from './furiten';

const PLAYER_ORDER: PlayerId[] = [0, 1, 2, 3];

export function canTsumo(state: GameState, playerId: PlayerId): WinResultEntry | null {
  const player = state.players[playerId];
  const winTile = player.drawnTile ?? player.hand[player.hand.length - 1];
  if (!winTile) return null;

  const preWinHand = removeWinningTile(player.hand, winTile);
  const score = evaluateWin(player.hand, createWinContext(state, playerId, winTile, true, state.riichiSticks, preWinHand));
  if (!hasRealYaku(score.yaku)) return null;

  return {
    winner: playerId,
    from: null,
    winType: 'tsumo',
    winTile,
    yaku: score.yaku,
    dora: score.dora,
    uraDora: score.uraDora,
    redDora: score.redDora,
    han: score.han,
    fu: score.fu,
    points: score.points.total,
    pointDeltas: tsumoDeltas(state, playerId, score.points),
  };
}

export interface RonOptions {
  winningTileSource?: WinningTileSource;
  candidatePlayers?: PlayerId[];
  riichiSticks?: number;
}

export function canRon(state: GameState, discarder: PlayerId, discardedTile: Tile, options: RonOptions = {}): WinResultEntry[] {
  const allowed = new Set(options.candidatePlayers ?? playersAfter(discarder));
  const ronCandidates = playersAfter(discarder).filter((playerId) => allowed.has(playerId));

  const wins = ronCandidates.flatMap((playerId) => {
    const player = state.players[playerId];
    const handWithDiscard = [...player.hand, discardedTile];
    const score = evaluateWin(handWithDiscard, createWinContext(state, playerId, discardedTile, false, options.riichiSticks ?? 0, player.hand, options.winningTileSource));
    if (!hasRealYaku(score.yaku) || !score.points.ron) return [];
    if (!canRonWithFuritenCheck(state, playerId)) return [];

    return [{
      winner: playerId,
      from: discarder,
      winType: 'ron' as const,
      winTile: discardedTile,
      yaku: score.yaku,
      dora: score.dora,
      uraDora: score.uraDora,
      redDora: score.redDora,
      han: score.han,
      fu: score.fu,
      points: score.points.ron,
      pointDeltas: ronDeltas(playerId, discarder, score.points.ron),
    }];
  });

  const riichiSticks = options.riichiSticks ?? state.riichiSticks;
  if (wins.length === 0 || riichiSticks === 0) return wins;
  const stickBonus = riichiSticks * 1000;
  return wins.map((win, index) => {
    if (index !== 0) return win;
    return {
      ...win,
      points: win.points + stickBonus,
      pointDeltas: ronDeltas(win.winner, discarder, win.points + stickBonus),
    };
  });
}

export function buildTsumoResult(state: GameState, playerId: PlayerId): RoundResult | null {
  const win = canTsumo(state, playerId);
  if (!win) return null;
  return {
    type: 'tsumo',
    winners: [win],
    pointDeltas: win.pointDeltas,
  };
}

export function buildRonResult(state: GameState, discarder: PlayerId, discardedTile: Tile, options: RonOptions = {}): RoundResult | null {
  const wins = canRon(state, discarder, discardedTile, options);
  if (wins.length === 0) return null;
  const config = { ...defaultRuleConfig, ...(state.ruleConfig ?? {}) };
  const matchConfig = { ...defaultMatchRuleConfig, ...(state.matchRuleConfig ?? {}) };
  const resolvedWins = matchConfig.useOka ? wins.slice(0, 1) : wins;

  if (resolvedWins.length === 3 && config.tripleRonMode === 'abortive-draw') {
    return buildAbortiveDrawResult('sanchahou', { triggeringPlayer: discarder });
  }

  return {
    type: 'ron',
    winners: resolvedWins,
    pointDeltas: combineDeltas(resolvedWins.map((win) => win.pointDeltas)),
  };
}

function createWinContext(state: GameState, playerId: PlayerId, winTile: Tile, isTsumo: boolean, riichiSticks = state.riichiSticks, preWinHand: Tile[] = [], winningTileSource?: WinningTileSource): WinContext {
  return createScoringWinContext({
    state,
    playerId,
    winningTile: winTile,
    winType: isTsumo ? 'tsumo' : 'ron',
    preWinHand,
    riichiSticks,
    winningTileSource,
  });
}

function hasRealYaku(yaku: { han: number; yakuman?: boolean }[]): boolean {
  return yaku.some((item) => item.han > 0 || item.yakuman);
}

function playersAfter(discarder: PlayerId): PlayerId[] {
  return [1, 2, 3]
    .map((offset) => ((discarder + offset) % 4) as PlayerId)
    .filter((playerId) => PLAYER_ORDER.includes(playerId));
}

function tsumoDeltas(state: GameState, winner: PlayerId, points: { tsumoDealer?: number; tsumoChild?: number; total: number }): number[] {
  const deltas = [0, 0, 0, 0];
  const isDealer = state.players[winner].seatWind === 'east';

  PLAYER_ORDER.forEach((playerId) => {
    if (playerId === winner) return;
    const payment = isDealer
      ? points.tsumoChild ?? 0
      : state.players[playerId].seatWind === 'east'
        ? points.tsumoDealer ?? 0
        : points.tsumoChild ?? 0;
    deltas[playerId] -= payment;
    deltas[winner] += payment;
  });

  deltas[winner] += state.riichiSticks * 1000;
  return deltas;
}

function ronDeltas(winner: PlayerId, discarder: PlayerId, points: number): number[] {
  const deltas = [0, 0, 0, 0];
  deltas[winner] += points;
  deltas[discarder] -= points;
  return deltas;
}

function combineDeltas(allDeltas: number[][]): number[] {
  return allDeltas.reduce(
    (combined, deltas) => combined.map((value, index) => value + (deltas[index] ?? 0)),
    [0, 0, 0, 0],
  );
}

function removeWinningTile(hand: Tile[], winningTile: Tile): Tile[] {
  const instanceIndex = hand.findIndex((tile) => tile.instanceId === winningTile.instanceId);
  if (instanceIndex !== -1) return hand.filter((_, index) => index !== instanceIndex);
  const idIndex = hand.findIndex((tile) => tile.id === winningTile.id);
  return idIndex === -1 ? hand : hand.filter((_, index) => index !== idIndex);
}

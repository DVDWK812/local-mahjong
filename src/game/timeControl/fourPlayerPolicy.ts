import { declareRon, declareTsumo, discardTile, passRon } from '../engine';
import { passCall } from '../callChecker';
import { canChankan, declareChankanRon, passChankan } from '../kanChecker';
import { legalDiscardTiles } from '../kuikae';
import { canTsumo } from '../winChecker';
import { hasDrawAction } from '../interaction';
import type { GameState, Tile } from '../types';
import type { Decision, DecisionSpec } from './decisionClock';
import type { ModePolicy } from './matchRuntime';

export const FOUR_HUMAN = 'four:0';
export function canonicalLegalTile(tiles: readonly Tile[]): Tile | undefined {
  return [...tiles].sort((a, b) => b.id - a.id || Number(a.red) - Number(b.red)
    || (a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0))[0];
}
function specs(s: GameState): DecisionSpec[] {
  const participantId = FOUR_HUMAN;
  if (s.result) return [];
  if (s.phase === 'discard' && s.currentPlayer === 0) {
    const budgetId = `turn:${s.turn}:${s.players[0].river.length}`;
    return [{ participantId, kind: 'turn', budgetId, key: `${budgetId}:${s.players[0].drawnTile?.instanceId ?? 'after-call'}` }];
  }
  if ((s.phase === 'ron-window' && s.pendingRon?.eligibleRonPlayers.includes(0) && !s.pendingRon.passedPlayers.includes(0))
    || (s.phase === 'call-window' && s.pendingCall?.options.some(o => o.player === 0))) {
    const key = `response:${s.pendingRon?.tile.instanceId ?? s.pendingCall?.tile.instanceId}`;
    return [{ participantId, kind: 'response', budgetId: key, key }];
  }
  if (canChankan(s, 0)) {
    const key = `chankan:${s.pendingKakan!.addedTileInstanceId}`;
    return [{ participantId, kind: 'response', budgetId: key, key }];
  }
  return [];
}
function timeout(s: GameState, d: Decision): GameState {
  if (d.kind === 'response') {
    if (s.phase === 'ron-window') return passRon(s, 0);
    if (s.phase === 'chankan-window') return passChankan(s, 0);
    return passCall(s);
  }
  const player = s.players[0];
  const drawn = player.drawnTile;
  const lastCall = player.calls[player.calls.length - 1];
  const afterCall = !drawn && (lastCall?.type === 'chi' || lastCall?.type === 'pon')
    && !!s.lastDiscard && lastCall.tiles.some(t => t.instanceId === s.lastDiscard!.tile.instanceId);
  if (!drawn && !afterCall) throw new Error('正常摸牌回合缺失真实摸入牌，已停止自动操作');
  const legal = legalDiscardTiles(s, 0).filter(t => !player.riichi || !drawn || t.instanceId === drawn.instanceId);
  const tile = drawn ? legal.find(t => t.instanceId === drawn.instanceId) : canonicalLegalTile(legal);
  if (!tile) throw new Error('必须弃牌但没有合法超时弃牌，已停止自动操作');
  return discardTile(s, 0, tile.instanceId);
}
export const fourPlayerPolicy: ModePolicy<GameState> = {
  mode: 'four',
  // App installs a fresh runtime for EVERY hand (including renchan). Dead wall changes during Kan!
  handId: s => `${s.roundWind}:${s.dealer}`,
  decisions: specs, timeout,
  isSuppressedCall: (before, after) => !!after.pendingKakan && after.pendingKakan.declarer === 0 && before.pendingKakan !== after.pendingKakan
    || after.players[0].calls.length !== before.players[0].calls.length
    || after.players[0].calls.some((call, index) => call.type !== before.players[0].calls[index]?.type),
  suspend: (before, after, d) => d.kind === 'turn' && !after.result && (
    (after.pendingKakan?.declarer === 0 && before.pendingKakan !== after.pendingKakan)
    || after.players[0].calls.filter(c => c.type === 'kan').length > before.players[0].calls.filter(c => c.type === 'kan').length),
  automatic: (s, d, p) => {
    const ron = s.phase === 'ron-window' && !!s.pendingRon?.eligibleRonPlayers.includes(0);
    const chankan = canChankan(s, 0);
    const tsumo = s.phase === 'discard' && s.currentPlayer === 0 && canTsumo(s, 0) !== null;
    if (p.autoWin && (ron || chankan || tsumo)) return { state: ron ? declareRon(s, 0) : chankan ? declareChankanRon(s, 0) : declareTsumo(s, 0), source: 'auto-win' };
    if (p.suppressCalls && s.phase === 'call-window' && !ron && !chankan) return { state: passCall(s), source: 'suppress-calls' };
    const forcedRiichiDiscard = s.players[0].riichi && !hasDrawAction(s, 0);
    if (d.kind === 'turn' && (p.autoTsumogiri || forcedRiichiDiscard) && !tsumo && s.players[0].drawnTile) {
      const next = discardTile(s, 0, s.players[0].drawnTile.instanceId);
      if (next !== s) return { state: next, source: 'auto-tsumogiri' };
    }
    return null;
  },
};

import { describe, expect, it } from 'vitest';
import { createInitialMatchLog, createEventFactory, finishMatchLog, recordGameStateTransition, startRoundInMatchLog, tileSnapshot } from './eventRecorder';
import { createTile } from '../tileUtils';
import { startMatch } from '../match/matchEngine';
import { getRulePreset } from '../match/matchRules';
import { discardTile } from '../engine';
import { calculateFinalScores } from '../match/finalRanking';
import { validateMatchLog } from './validation';

describe('eventRecorder', () => {
  it('records sequential unique events and tile instance snapshots', () => {
    const factory = createEventFactory('r1');
    const tile = { ...createTile(4, 2), red: true };
    const draw = factory({ type: 'tile-drawn', actor: 0, tile: tileSnapshot(tile) });
    const discard = factory({ type: 'tile-discarded', actor: 0, tile: tileSnapshot(tile) });
    expect(draw.sequence).toBe(0);
    expect(discard.sequence).toBe(1);
    expect(draw.eventId).not.toBe(discard.eventId);
    expect(draw.type === 'tile-drawn' ? draw.tile.instanceId : '').toBe(tile.instanceId);
    expect(draw.type === 'tile-drawn' ? draw.tile.red : false).toBe(true);
  });

  it('从初始状态和牌局迁移记录发牌、弃牌与结算所需实例数据', () => {
    const rules = getRulePreset('east-round');
    const match = startMatch(rules.match);
    const game = match.currentGame!;
    const base = createInitialMatchLog({
      matchId: 'recorded-match',
      initialDealer: match.initialDealer,
      initialScores: match.scores,
      ruleConfig: rules,
    });
    const started = startRoundInMatchLog(base, game, match.handNumber);
    const discarded = discardTile(game, 0, game.players[0].hand[0].instanceId);
    const recorded = recordGameStateTransition(started, game, discarded);
    const discardEvent = recorded.rounds[0].events.find((event) => event.type === 'tile-discarded');

    expect(recorded.rounds[0].initialHands?.flat()).toHaveLength(53);
    expect(discardEvent?.type === 'tile-discarded' ? discardEvent.tile.instanceId : '').toBe(game.players[0].hand[0].instanceId);
    expect(discardEvent?.type === 'tile-discarded' ? typeof discardEvent.tile.red : '').toBe('boolean');

    const finalResult = calculateFinalScores({
      scores: [30000, 25000, 24000, 21000],
      riichiSticks: match.riichiSticks,
      initialDealer: match.initialDealer,
      ruleConfig: match.ruleConfig,
      endedBy: 'manual',
    });
    const completed = finishMatchLog(recorded, finalResult);
    expect(completed.finalResult?.finalScores).toEqual([30000, 25000, 24000, 21000]);
    expect(completed.rounds[0].events[completed.rounds[0].events.length - 1]?.type).toBe('match-ended');
  });

  it('多局各自校验牌实例和四份同牌，不会跨局误判', () => {
    const rules = getRulePreset('east-round');
    const match = startMatch(rules.match);
    const game = match.currentGame!;
    const base = createInitialMatchLog({
      matchId: 'multi-round',
      initialDealer: match.initialDealer,
      initialScores: match.scores,
      ruleConfig: rules,
    });
    const twoRounds = startRoundInMatchLog(startRoundInMatchLog(base, game, 1), game, 2);
    expect(() => validateMatchLog(twoRounds)).not.toThrow();
  });
});

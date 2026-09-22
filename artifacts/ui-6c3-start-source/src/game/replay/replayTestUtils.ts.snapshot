import { createTile } from '../tileUtils';
import { getRulePreset } from '../match/matchRules';
import { createEventFactory, createInitialMatchLog, tileSnapshot } from './eventRecorder';
import type { MatchLog } from './types';

export function sampleMatchLog(): MatchLog {
  const log = createInitialMatchLog({
    matchId: 'sample',
    initialDealer: 0,
    initialScores: [25000, 25000, 25000, 25000],
    ruleConfig: getRulePreset('mahjong-soul-style'),
  });
  const roundId = 'round-1';
  const makeEvent = createEventFactory(roundId);
  const draw = createTile(0, 0);
  const discard = createTile(1, 0);
  return {
    ...log,
    rounds: [{
      roundId,
      roundWind: 'east',
      handNumber: 1,
      dealer: 0,
      honba: 0,
      riichiSticks: 0,
      initialHands: [[tileSnapshot(discard)], [], [], []],
      wallOrder: [tileSnapshot(draw)],
      events: [
        makeEvent({ type: 'match-started' }),
        makeEvent({ type: 'round-started', roundWind: 'east', handNumber: 1, dealer: 0, honba: 0, riichiSticks: 0 }),
        makeEvent({ type: 'tiles-dealt', hands: [[tileSnapshot(discard)], [], [], []] }),
        makeEvent({ type: 'tile-drawn', actor: 0, tile: tileSnapshot(draw) }),
        makeEvent({ type: 'tile-discarded', actor: 0, tile: tileSnapshot(discard) }),
      ],
    }],
  };
}

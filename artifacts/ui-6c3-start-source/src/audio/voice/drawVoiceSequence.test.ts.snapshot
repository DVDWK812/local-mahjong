import { describe, expect, it } from 'vitest';
import type { PresentationEvent } from '../../presentation/PresentationEventBus';
import { PresentationEventBus } from '../../presentation/PresentationEventBus';
import { buildDrawVoiceSequence } from './drawVoiceSequence';

function exhaustive(activePlayerIds: readonly (0 | 1 | 2 | 3)[], tenpaiPlayers: readonly (0 | 1 | 2 | 3)[]) {
  const bus = new PresentationEventBus();
  const event = bus.publish({
    type: 'round_settled', settlementType: 'exhaustive-draw', activePlayerIds,
    tenpaiPlayers, notenPlayers: activePlayerIds.filter((player) => !tenpaiPlayers.includes(player)),
  });
  return event as Extract<PresentationEvent, { type: 'round_settled'; settlementType: 'exhaustive-draw' }>;
}

describe('buildDrawVoiceSequence', () => {
  it('announces draw then uses authoritative tenpai/noten data in stable four-seat order', () => {
    const sequence = buildDrawVoiceSequence(exhaustive([0, 1, 2, 3], [0, 2]));
    expect(sequence.items).toEqual([
      { voiceKey: 'game.draw' },
      { voiceKey: 'yaku.tenpai', actorId: 0 }, { voiceKey: 'yaku.noten', actorId: 1 },
      { voiceKey: 'yaku.tenpai', actorId: 2 }, { voiceKey: 'yaku.noten', actorId: 3 },
    ]);
  });

  it.each([
    [[0, 1] as const, [1] as const, ['game.draw', 'yaku.noten', 'yaku.tenpai']],
    [[2, 0, 1] as const, [2, 1] as const, ['game.draw', 'yaku.tenpai', 'yaku.noten', 'yaku.tenpai']],
  ])('supports active player counts without manufacturing inactive seats', (activePlayerIds, tenpaiPlayers, keys) => {
    expect(buildDrawVoiceSequence(exhaustive(activePlayerIds, tenpaiPlayers)).items.map((item) => item.voiceKey)).toEqual(keys);
  });
});

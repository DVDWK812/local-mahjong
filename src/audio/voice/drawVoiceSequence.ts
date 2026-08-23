import type { PlayerId } from '../../game/types';
import type { RoundSettledPresentationEvent } from '../../presentation/PresentationEventBus';

export interface DrawVoiceSequenceItem {
  readonly voiceKey: 'game.draw' | 'yaku.tenpai' | 'yaku.noten';
  readonly actorId?: PlayerId;
}

export interface DrawVoiceSequence {
  readonly id: string;
  readonly items: readonly DrawVoiceSequenceItem[];
}

/** Uses only the exhaustive-draw result snapshot supplied by the engine observer. */
export function buildDrawVoiceSequence(
  event: Extract<RoundSettledPresentationEvent, { settlementType: 'exhaustive-draw' }>,
): DrawVoiceSequence {
  const tenpai = new Set(event.tenpaiPlayers);
  const noten = new Set(event.notenPlayers);
  const items: DrawVoiceSequenceItem[] = [{ voiceKey: 'game.draw' }];
  event.activePlayerIds.forEach((playerId) => {
    if (tenpai.has(playerId)) items.push({ voiceKey: 'yaku.tenpai', actorId: playerId });
    else if (noten.has(playerId)) items.push({ voiceKey: 'yaku.noten', actorId: playerId });
  });
  return { id: event.eventId, items };
}

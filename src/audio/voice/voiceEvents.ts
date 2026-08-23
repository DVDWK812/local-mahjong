import type { PresentationEvent, VoiceAbortiveDrawReason } from '../../presentation/PresentationEventBus';

export const VOICE_EVENT_PRIORITIES = {
  'action.ron': 100,
  'action.tsumo': 100,
  'action.riichi': 80,
  'action.double_riichi': 80,
  'action.chi': 70,
  'action.pon': 70,
  'action.kan': 70,
  'action.ankan': 70,
  'action.kakan': 70,
  'game.draw': 85,
  'game.four_winds_abortive_draw': 85,
  'game.four_kans_abortive_draw': 85,
  'game.four_riichi_abortive_draw': 85,
  'game.nine_terminals_and_honors_abortive_draw': 85,
} as const;

export type VoiceEventKey = keyof typeof VOICE_EVENT_PRIORITIES;

export interface VoiceEvent {
  readonly eventId: string;
  readonly key: VoiceEventKey;
  readonly actorId?: string;
  readonly priority: number;
}

/** Converts confirmed presentation events to one mutually exclusive semantic VoiceEvent. */
export function voiceEventFromPresentation(event: PresentationEvent): VoiceEvent | undefined {
  if (event.type === 'riichi_declared') return createVoiceEvent(event.eventId, event.kind === 'double-riichi' ? 'action.double_riichi' : 'action.riichi', event.playerId);
  if (event.type === 'meld_declared') {
    const key: VoiceEventKey = event.meldType !== 'kan'
      ? `action.${event.meldType}`
      : event.kanType === 'ankan' ? 'action.ankan'
        : event.kanType === 'kakan' ? 'action.kakan'
          : 'action.kan';
    return createVoiceEvent(event.eventId, key, event.playerId);
  }
  // A winning hand is narrated only by its subsequent win_scored sequence. Keeping
  // win_declared out of the realtime channel prevents a duplicate action call.
  if (event.type === 'win_declared' || event.type === 'win_scored') return undefined;
  if (event.type === 'round_settled' && event.settlementType === 'exhaustive-draw') return createVoiceEvent(event.eventId, 'game.draw');
  if (event.type === 'round_settled') return createVoiceEvent(event.eventId, abortiveDrawVoiceKey(event.reason), event.triggeringPlayerId);
  return undefined;
}

function abortiveDrawVoiceKey(reason: VoiceAbortiveDrawReason): VoiceEventKey {
  const keys = {
    'suufon-renda': 'game.four_winds_abortive_draw',
    'suukan-sanra': 'game.four_kans_abortive_draw',
    'suucha-riichi': 'game.four_riichi_abortive_draw',
    'kyuushu-kyuuhai': 'game.nine_terminals_and_honors_abortive_draw',
  } as const satisfies Record<VoiceAbortiveDrawReason, VoiceEventKey>;
  return keys[reason];
}

function createVoiceEvent(eventId: string, key: VoiceEventKey, playerId?: number): VoiceEvent {
  return { eventId, key, actorId: playerId === undefined ? undefined : String(playerId), priority: VOICE_EVENT_PRIORITIES[key] };
}

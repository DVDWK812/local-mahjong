import type { PlayerId, RoundResult, Wind } from '../types';
import { windLabel } from '../tileUtils';
import { maxExtraWindIndex, scheduledFinalWind } from './matchRules';
import type { MatchState, RoundWind } from './types';

export const ROUND_WINDS: RoundWind[] = ['east', 'south', 'west', 'north'];

export function roundLabel(state: Pick<MatchState, 'roundWind' | 'handNumber'>): string {
  return `${windLabel(state.roundWind)}${state.handNumber}局`;
}

export function seatWindForPlayer(dealer: PlayerId, playerId: PlayerId): Wind {
  const offset = (playerId - dealer + 4) % 4;
  return ROUND_WINDS[offset];
}

export function dealerWon(result: RoundResult, dealer: PlayerId): boolean {
  return (result.type === 'ron' || result.type === 'tsumo') && result.winners.some((win) => win.winner === dealer);
}

export function isWinResult(result: RoundResult): boolean {
  return result.type === 'ron' || result.type === 'tsumo';
}

export function dealerContinuesFromResult(state: MatchState, result: RoundResult): boolean {
  if (result.type === 'abortive-draw') return result.dealerContinues;
  if (result.type === 'exhaustive-draw') return result.dealerContinues;
  return state.ruleConfig.dealerContinuationOnWin && dealerWon(result, state.dealer);
}

export function advanceRoundPosition(state: MatchState): Pick<MatchState, 'dealer' | 'roundWind' | 'handNumber'> {
  const dealer = ((state.dealer + 1) % 4) as PlayerId;
  if (state.handNumber < 4) {
    return {
      dealer,
      roundWind: state.roundWind,
      handNumber: (state.handNumber + 1) as MatchState['handNumber'],
    };
  }
  const windIndex = ROUND_WINDS.indexOf(state.roundWind);
  return {
    dealer,
    roundWind: ROUND_WINDS[Math.min(windIndex + 1, ROUND_WINDS.length - 1)],
    handNumber: 1,
  };
}

export function isScheduledFinalRound(state: MatchState): boolean {
  return state.roundWind === scheduledFinalWind(state.ruleConfig) && state.handNumber === 4;
}

export function isExtraRound(state: MatchState): boolean {
  return ROUND_WINDS.indexOf(state.roundWind) > ROUND_WINDS.indexOf(scheduledFinalWind(state.ruleConfig));
}

export function reachedMaxExtraRound(state: MatchState): boolean {
  return isExtraRound(state) && state.handNumber === 4 && ROUND_WINDS.indexOf(state.roundWind) >= maxExtraWindIndex(state.ruleConfig);
}

export function hasReachedTarget(scores: readonly number[], target: number): boolean {
  return scores.some((score) => score >= target);
}

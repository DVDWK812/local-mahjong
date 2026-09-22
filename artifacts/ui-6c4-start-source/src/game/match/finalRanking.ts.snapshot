import type { PlayerId } from '../types';
import type { FinalPlayerResult, MatchResult, MatchRuleConfig } from './types';

const PLAYERS: PlayerId[] = [0, 1, 2, 3];

export function rankTieBreakOrder(initialDealer: PlayerId, player: PlayerId): number {
  return (player - initialDealer + 4) % 4;
}

export function calculateFinalRanking(scores: readonly number[], initialDealer: PlayerId): FinalPlayerResult[] {
  return PLAYERS
    .map((player) => ({
      player,
      rawScore: scores[player] ?? 0,
      rankTieBreakOrder: rankTieBreakOrder(initialDealer, player),
    }))
    .sort((a, b) => b.rawScore - a.rawScore || a.rankTieBreakOrder - b.rankTieBreakOrder)
    .map((entry, index) => ({
      ...entry,
      rank: (index + 1) as FinalPlayerResult['rank'],
    }));
}

export function roundMatchScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function calculateFinalScores(params: {
  scores: [number, number, number, number];
  riichiSticks: number;
  initialDealer: PlayerId;
  ruleConfig: MatchRuleConfig;
  endedBy: MatchResult['endedBy'];
}): MatchResult {
  const { initialDealer, ruleConfig, endedBy } = params;
  const finalScores = [...params.scores] as [number, number, number, number];
  const leftoverPoints = params.riichiSticks * 1000;
  let leftoverRiichiSticksAwardedTo: PlayerId | undefined;

  if (leftoverPoints > 0 && ruleConfig.leftoverRiichiStickMode !== 'discard') {
    leftoverRiichiSticksAwardedTo = ruleConfig.leftoverRiichiStickMode === 'initial-dealer'
      ? initialDealer
      : calculateFinalRanking(finalScores, initialDealer)[0].player;
    finalScores[leftoverRiichiSticksAwardedTo] += leftoverPoints;
  }

  const ranking = calculateFinalRanking(finalScores, initialDealer);
  const players = ranking.map((entry) => {
    const convertedScore = roundMatchScore((entry.rawScore - ruleConfig.returnPoints) / 1000);
    const umaAdjustment = ruleConfig.useUma ? ruleConfig.uma[entry.rank - 1] : 0;
    const okaAdjustment = 0;
    return {
      ...entry,
      convertedScore,
      umaAdjustment,
      okaAdjustment,
      finalMatchScore: roundMatchScore(convertedScore + umaAdjustment + okaAdjustment),
    };
  });

  return {
    players,
    leftoverRiichiSticksAwardedTo,
    leftoverRiichiStickPoints: leftoverPoints,
    finalScores,
    endedBy,
  };
}

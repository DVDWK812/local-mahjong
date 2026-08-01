import type { MatchState } from '../match/types';
import type { MatchLog } from '../replay/types';
import type { ReplayRecord, ReplaySource } from './storageTypes';
import { CURRENT_REPLAY_RECORD_VERSION } from './storageTypes';
import { createFullRuleConfig, type MatchRuleConfigInput } from '../match/matchRules';
import { assertCurrentFormatVersion } from '../versionPolicy';

export function createReplayRecord(params: {
  log: MatchLog;
  matchState?: MatchState;
  completed?: boolean;
  title?: string;
  updatedAt?: string;
  scores?: [number, number, number, number];
  source?: ReplaySource;
}): ReplayRecord {
  assertCurrentFormatVersion('MatchLog', params.log?.version);
  const { matchState } = params;
  const log = {
    ...params.log,
    ruleConfig: createFullRuleConfig(params.log.ruleConfig.round, params.log.ruleConfig.match as MatchRuleConfigInput),
  };
  const createdAt = validDate(log.createdAt) ? log.createdAt : new Date().toISOString();
  const updatedAt = params.updatedAt ?? new Date().toISOString();
  const finalScores = log.finalResult?.finalScores;
  const currentScores = params.scores ?? matchState?.scores;
  const scores = finalScores ?? currentScores ?? log.initialScores;
  const roundCount = Math.max(matchState?.completedHands ?? 0, log.rounds.length);
  const matchType = log.ruleConfig.match.matchLength === 'hanchan' ? 'four-south' : 'four-east';
  return {
    version: CURRENT_REPLAY_RECORD_VERSION,
    id: log.matchId,
    matchId: log.matchId,
    title: params.title?.trim() || defaultReplayTitle(createdAt),
    createdAt,
    updatedAt,
    playerNames: log.playerNames,
    scores: [...scores] as [number, number, number, number],
    matchType,
    roundCount,
    source: params.source ?? 'local-match',
    status: params.completed || !!log.finalResult ? 'completed' : 'incomplete',
    log,
  };
}

export function normalizeReplayRecord(input: unknown): ReplayRecord {
  if (!input || typeof input !== 'object') throw new Error('牌谱记录不是对象');
  const candidate = input as Partial<ReplayRecord & MatchLog>;
  if ('log' in candidate && candidate.log) {
    assertCurrentFormatVersion('ReplayRecord', candidate.version);
    const log = candidate.log;
    assertCurrentFormatVersion('MatchLog', log.version);
    return createReplayRecord({
      log,
      completed: candidate.status === 'completed',
      title: candidate.title,
      updatedAt: validDate(candidate.updatedAt) ? candidate.updatedAt : undefined,
    });
  }
  if ('matchId' in candidate && 'rounds' in candidate) {
    assertCurrentFormatVersion('MatchLog', candidate.version);
    return createReplayRecord({ log: candidate as MatchLog });
  }
  throw new Error('牌谱缺少日志数据');
}

function defaultReplayTitle(createdAt: string): string {
  const date = new Date(createdAt);
  return Number.isFinite(date.getTime())
    ? `本地对局 ${date.toLocaleString('zh-CN', { hour12: false })}`
    : '本地对局';
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

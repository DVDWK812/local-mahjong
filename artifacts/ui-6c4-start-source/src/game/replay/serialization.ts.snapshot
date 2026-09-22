import type { MatchLog } from './types';
import { validateMatchLog } from './validation';

export function serializeMatchLog(log: MatchLog): string {
  validateMatchLog(log);
  return JSON.stringify(log);
}

export function deserializeMatchLog(raw: string): MatchLog {
  const parsed = JSON.parse(raw) as MatchLog;
  validateMatchLog(parsed);
  return parsed;
}

import { describe, expect, it } from 'vitest';
import { inspectXzReport } from './report';
import { applyXz } from './engine';
import { loadXzScenario, xzCases } from './scenarios';
import { parseXzSave, replayXz, saveXz } from './persistence';

describe('XZ-6R 下载格式与部分响应恢复', () => {
  it('报告独立格式校验，拒绝拿回放充当报告', () => {
    const code = { fingerprint: 'fixed-source', snapshotId: 'fixed-snapshot' };
    const entry = { caseVersion: 1, ruleId: 'r1', caseHash: 'c1', code, automatic: '通过', manual: '待复核' };
    expect(inspectXzReport(JSON.stringify({ mode: 'xuezhan', schemaVersion: 1, code, results: { 'XZ-TRIPLE': entry } }))).toEqual({ cases: 1, fingerprint: 'fixed-source', snapshotId: 'fixed-snapshot' });
    expect(() => inspectXzReport(JSON.stringify({ mode: 'xuezhan', schemaVersion: 1, actions: [] }))).toThrow();
    expect(() => inspectXzReport(JSON.stringify({ mode: 'xuezhan', schemaVersion: 1, code, results: { 'XZ-TRIPLE': { ...entry, manual: '自动代填' } } }))).toThrow();
  });
  it('三响第一人确认后落盘格式恢复：未提前记账，剩余响应只产生三笔1分胡账', () => {
    let s = loadXzScenario(xzCases().find(t => t.id === 'XZ-TRIPLE')!.scenario);
    s = applyXz(s, 1, { type: 'win' });
    expect(s.ledger).toEqual([]);
    s = replayXz(parseXzSave(JSON.stringify(saveXz(s))));
    expect(s.response?.replies).toEqual({ 1: 'win' });
    s = applyXz(s, 2, { type: 'win' }); s = applyXz(s, 3, { type: 'win' });
    expect(s.wins.map(w => w.winners)).toEqual([[1, 2, 3]]);
    expect(s.ledger.map(e => [e.reason, e.from, e.to, e.amount])).toEqual([['win', 0, 1, 1], ['win', 0, 2, 1], ['win', 0, 3, 1]]);
    expect(s.players.map(p => p.score)).toEqual([97, 101, 101, 101]);
  });
});

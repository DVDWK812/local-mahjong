import { describe, expect, it } from 'vitest';
import { createConfig, PATTERNS, PRESETS, presetRules, ruleId, RANGES, validateRules, type Pattern, type Preset, type XzRules } from './config';
import { RULE_FIELDS } from './fields';
import { runXzCase, xzCases, type XzTestCase } from './scenarios';
import { assertXzInvariants, createXzMatch, applyXz, legalActions, SEATS, seededRandom } from './engine';
import { chooseXzAction, observeXz } from './ai';
import { replayXz, saveXz, stateDigest } from './persistence';
import { ModeResultsStorage } from '../testMode/resultsStorage';
describe('浏览器和 CLI 同源血战场景', () => {
  for (const test of xzCases()) it(test.id, () => { const result = runXzCase(test); expect(result.error).toBeUndefined(); expect(result.passed).toBe(true); });
  it('血战结果分区不改旧模式记录', () => {
    const map = new Map<string, string>([['local-mahjong.test-mode.case-results.v1', 'old']]);
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
    const store = new ModeResultsStorage(storage, 'xuezhan', 1); store.save({ one: { automatic: '通过', manual: '待复核' } });
    expect(map.get('local-mahjong.test-mode.case-results.v1')).toBe('old'); expect(store.load()).toEqual({ one: { automatic: '通过', manual: '待复核' } });
  });
});
function withDependencies(r: XzRules): XzRules {
  if (r.selfDrawOnly) { r.multiWin = false; r.passWin = 'off'; r.robKong = false; }
  if (!r.kongPay) { r.transfer = false; r.refund = 'off'; }
  if (!r.cap) r.pigPenalty = 'fixed';
  return r;
}
const branches = RULE_FIELDS.flatMap(f => {
  const d = presetRules()[f.key];
  const values = f.options?.map(v => v[0]) ?? (typeof d === 'boolean' ? [false, true] : RANGES[f.key] ? [...RANGES[f.key]!] : []);
  return values.map(value => ({ key: f.key, value }));
});
describe('全部暴露字段与合法配置组合', () => {
  for (const { key, value } of branches) it(`${key}=${value}`, () => {
    const r = withDependencies({ ...presetRules(), [key]: value });
    expect(validateRules(r)[key]).toEqual(value);
    const config = createConfig(r), s = createXzMatch(config, 991); assertXzInvariants(s);
    expect(replayXz(saveXz(s)).config.rules[key]).toEqual(value);
  });
  for (const id of Object.keys(PATTERNS) as Pattern[]) for (const enabled of [false, true]) for (const fan of [0, 3]) it(`${id}/${enabled}/${fan}`, () => {
    const r = presetRules(); r.patterns[id] = { enabled, fan };
    expect(createXzMatch(createConfig(r), 1).config.rules.patterns[id]).toEqual({ enabled, fan });
  });
  it('合法字段两两组合：逐对创建并走完一小局，记录数量', () => {
    let covered = 0, invalid = 0;
    for (let i = 0; i < branches.length; i++) for (let j = i + 1; j < branches.length; j++) {
      const a = branches[i], b = branches[j]; if (a.key === b.key) continue;
      const r = { ...presetRules(), [a.key]: a.value, [b.key]: b.value };
      // No coercion in pair coverage: invalid dependency pairs are counted as rejected.
      try { validateRules(r); } catch { invalid++; continue; }
      const c = createConfig(r); expect(c.rules[a.key]).toEqual(a.value); expect(c.rules[b.key]).toEqual(b.value);
      const seed = 30000 + covered; let s = createXzMatch(c, seed);
      try {
        for (let step = 0; step < 650 && s.phase !== 'ended'; step++) {
          const seat = SEATS.find(id => legalActions(s, id).length > 0); if (seat === undefined) throw new Error('组合局没有合法动作');
          const action = chooseXzAction(observeXz(s, seat), { difficulty: 'shintentai', personality: 'balanced' }); if (!action) throw new Error('组合局 AI 无动作');
          const next = applyXz(s, seat, action); if (next === s) throw new Error('组合局 AI 非法动作'); s = next; assertXzInvariants(s);
        }
        expect(s.phase).toBe('ended');
      } catch (error) { console.error(JSON.stringify({ matrix: [a, b], seed, save: saveXz(s), error: String(error) })); throw error; }
      covered++;
    }
    console.info(JSON.stringify({ matrix: 'all-field-value-pairs', covered, invalidDependencyPairs: invalid }));
    expect(covered).toBeGreaterThan(1000);
  }, 180000);
});
describe('固定种子完整压力批次', () => {
  it('1000 小局：每预设200，另200合法随机配置；650步上限', () => {
    const presets = Object.keys(PRESETS) as Preset[], random = seededRandom(20260922);
    const counts: Record<string, number> = {}, stats = { rounds: 0, maxSteps: 0, wins: 0, wall: 0, winningPlayers: 0, multiWinGroups: 0, wallByWonCount: [0, 0, 0, 0], threeWinners: 0 };
    for (let sample = 0; sample < 1000; sample++) {
      const preset = presets[sample % 4]; let rules = { ...presetRules(preset), rounds: 1 };
      if (sample >= 800) {
        for (let n = 0; n < 6; n++) { const branch = branches[Math.floor(random() * branches.length)]; if (!['rounds', 'startingScore'].includes(branch.key)) rules = { ...rules, [branch.key]: branch.value }; }
        rules = withDependencies(rules);
      }
      counts[sample < 800 ? preset : 'random'] = (counts[sample < 800 ? preset : 'random'] ?? 0) + 1;
      const config = createConfig(rules), seed = 10000 + sample;
      let s = createXzMatch(config, seed), steps = 0;
      try {
        for (; steps < 650 && !s.completed; steps++) {
          const seat = SEATS.find(id => legalActions(s, id).length > 0); if (seat === undefined) throw new Error(`无合法动作 ${s.phase}`);
          const action = chooseXzAction(observeXz(s, seat), { difficulty: sample % 25 === 0 ? 'kishin' : sample % 10 === 0 ? 'upper' : sample % 3 ? 'shintentai' : 'chikukon', personality: (['balanced', 'aggressive', 'defensive'] as const)[sample % 3] });
          if (!action) throw new Error('AI 没有动作'); const next = applyXz(s, seat, action); if (next === s) throw new Error('AI 非法动作'); s = next;
          assertXzInvariants(s);
        }
        expect(s.completed).toBe(true); expect(s.phase).toBe('ended');
        if (sample % 20 === 0) expect(stateDigest(replayXz(saveXz(s)))).toBe(stateDigest(s));
        stats.rounds++; stats.maxSteps = Math.max(stats.maxSteps, steps); stats.wins += s.wins.length; if (s.results[0].reason === 'wall') stats.wall++;
        const won = s.players.filter(p => p.won !== null).length;
        stats.winningPlayers += won; stats.multiWinGroups += s.wins.filter(w => w.winners.length > 1).length;
        if (s.results[0].reason === 'wall') stats.wallByWonCount[won]++; else stats.threeWinners++;
      } catch (error) { console.error(JSON.stringify({ seed, ruleId: ruleId(rules), save: saveXz(s), steps, error: String(error) })); throw error; }
    }
    console.info(JSON.stringify({ seeds: [10000, 10999], counts, stats, definitions: { wins: '成功胡牌组数（多响计一组）', maxSteps: '已接受生产命令数，含准备和每位玩家响应', wall: '墙尽结束局数，不等于无人胡牌局数' } })); expect(stats.rounds).toBe(1000);
    expect(stats.wallByWonCount.reduce((a, b) => a + b, 0)).toBe(stats.wall);
    expect(stats.wall + stats.threeWinners).toBe(1000);
  }, 240000);
});

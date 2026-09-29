import type { TestCaseDefinition } from '../testMode/catalog';
import { createConfig, PRESETS, presetRules, ruleId, type Preset, type XzConfig } from './config';
import { applyXz, assertXzInvariants, createXzMatch, legalActions, makeWall, SEATS, defaultAction, participantId, readyScores } from './engine';
import { chooseXzAction, observeXz } from './ai';
import { replayXz, saveXz, stateDigest } from './persistence';
import type { Seat, XzAction, XzState } from './types';
import type { Tile } from '../types';
import { MatchRuntime } from '../timeControl/matchRuntime';
import type { Clock } from '../timeControl/decisionClock';
import { xzPolicy } from './runtime';
export interface XzScenario { version: 1; mode: 'xuezhan'; id: string; name: string; description: string; config: XzConfig; seed: number; initialWall?: Tile[]; actions?: Array<{ seat: Seat; action: XzAction }> }
export interface XzTestCase extends TestCaseDefinition<XzScenario> { group: string; risk: '高' | '中'; assertion: (s: XzState) => void; run: 'script' | 'complete'; execute?: (s: XzState) => XzState }
export function loadXzScenario(scenario: XzScenario): XzState {
  if (scenario.mode !== 'xuezhan' || scenario.version !== 1) throw new Error('不支持的血战场景版本');
  let s = createXzMatch(scenario.config, scenario.seed, scenario.initialWall);
  for (const record of scenario.actions ?? []) { const next = applyXz(s, record.seat, record.action); if (next === s) throw new Error('场景前置动作非法'); s = next; }
  assertXzInvariants(s); return s;
}
export function wallForHands(hands: number[][], dealer: Seat = 0): Tile[] {
  const pool = makeWall(55, 1), allocated = hands.map(hand => hand.map(id => { const i = pool.findIndex(t => t.id === id); if (i < 0) throw new Error(`夹具需要第五张 ${id}`); return pool.splice(i, 1)[0]; }));
  allocated.forEach((hand, i) => { while (hand.length < (i === dealer ? 14 : 13)) hand.push(pool.shift()!); });
  return [...allocated.flatMap(hand => hand.slice(0, 13)), allocated[dealer][13], ...pool];
}
const ids = (str: string) => str.split(' ').flatMap((part, suit) => [...part].map(n => +n - 1 + 9 * suit));
const ensure = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
function dispatch(s: XzState, seat: Seat, action: XzAction): XzState { const next = applyXz(s, seat, action); ensure(next !== s, `场景动作拒绝：${seat}/${action.type}`); assertXzInvariants(next); return next; }
function passAll(s: XzState): XzState { for (const seat of SEATS) if (s.phase === 'response' && legalActions(s, seat).some(a => a.type === 'pass')) s = dispatch(s, seat, { type: 'pass' }); return s; }
/** Reach the final draw exclusively through production draw/discard/pass transitions. */
function untilFinalDraw(s: XzState): XzState {
  for (let n = 0; n < 250 && !(s.phase === 'turn' && !s.wall.length); n++) {
    ensure(s.phase !== 'ended', '未到最后摸牌已意外结束');
    if (s.phase === 'response') s = passAll(s);
    else s = dispatch(s, s.current, defaultAction(s, s.current)!);
  }
  ensure(s.phase === 'turn' && !s.wall.length, '未到最后摸牌'); return s;
}
class ScenarioClock implements Clock {
  value = 0; token = 0; jobs = new Map<number, { at: number; fn: () => void }>();
  now = () => this.value;
  schedule = (fn: () => void, ms: number) => { const token = ++this.token; this.jobs.set(token, { at: this.value + ms, fn }); return token; };
  cancel = (token: unknown) => { this.jobs.delete(token as number); };
  advance(ms: number) { const end = this.value + ms; for (let n = 0; n < 100; n++) { const next = [...this.jobs].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) { this.value = end; return; } this.jobs.delete(next[0]); this.value = next[1].at; next[1].fn(); } throw new Error('计时用例未终止'); }
}
export function xzCases(): XzTestCase[] {
  const presetCases: XzTestCase[] = (Object.keys(PRESETS) as Preset[]).map((preset, index) => ({
    id: `XZ-PRESET-${index + 1}`, version: 1, type: 'hybrid', group: '准备与完整比赛', risk: '高', keywords: [PRESETS[preset], '计时', '保存', 'AI'],
    scenario: { mode: 'xuezhan', version: 1, id: `XZ-PRESET-${index + 1}`, name: `${PRESETS[preset]}完整比赛`, description: '从真实发牌开始，通过生产 AI 和合法动作到整场结果。', seed: 120 + index, config: createConfig({ ...presetRules(preset), rounds: 2 }) },
    steps: ['加载场景；完全控制默认开启，点击逐步执行推进', '按需关闭完全控制，真人选择换牌/定缺/弃牌', '小局结束后点击下一局，查看整场结果和账本'],
    expectedResults: ['四座不变；牌总数108；积分总和400；两小局完成；回放与实时摘要相同'],
    manualChecks: ['1280×720、1920×1080 的准备、牌桌和结算可操作', '胡后观战、手部和通用声音无错误日麻提示'], run: 'complete', assertion: s => { ensure(s.completed && s.results.length === 2, '未完成两小局'); },
  }));
  const multiConfig = createConfig({ ...presetRules('dynamic'), rounds: 1, firstDealer: 0 });
  const tripleWall = wallForHands([[0], ids('2343456781 789'), ids('1 123234567789'), ids('1  123234567789')]);
  const triple = createXzMatch(multiConfig, 55, tripleWall);
  const discard = triple.players[0].hand.find(t => t.id === 0)!;
  const tripleActions: XzScenario['actions'] = [{ seat: 0, action: { type: 'discard', tile: discard.instanceId } }];
  const scenario: XzScenario = { mode: 'xuezhan', version: 1, id: 'XZ-TRIPLE', name: '一炮三响 · 单一实体来源', description: '庄家已弃一万，三家均有合法胡牌；通过完全控制逐个声明。', config: multiConfig, seed: 55, initialWall: tripleWall, actions: tripleActions };
  const tripleCase: XzTestCase = { id: scenario.id, version: 1, type: 'hybrid', group: '行牌与胡牌', risk: '高', keywords: ['多响', '退出', '账本'], scenario,
    steps: ['加载后打开规则与账本，查看三家合法胡牌', '完全控制下对三家逐个点击 win（或逐步执行三次）', '查看三响和整场结果'], expectedResults: ['全部声明前不结算；三家统一退出；同一胡牌实体引用；三笔1分支付'], manualChecks: ['三家仍保留原座位', '结算仅出现一次、三赢家明细可核对'], run: 'script',
    assertion: s => { ensure(s.wins.length === 1 && s.wins[0].winners.length === 3, '三响未成立'); ensure(s.players.map(p => p.score).join(',') === '97,101,101,101', '三响独立金样不符'); },
  };
  const firstConfig = createConfig({ ...presetRules('dynamic'), firstDealer: 0, rounds: 1 });
  const first: XzScenario = { mode: 'xuezhan', version: 1, id: 'XZ-FIRST', name: '真人平胡自摸后继续观战', description: '真人起手平胡，三家各付2分；随后从下家继续摸牌。', config: firstConfig, seed: 56, initialWall: wallForHands([ids('123345789 45677'), [], [], []]) };
  const firstCase: XzTestCase = { id: first.id, version: 1, type: 'hybrid', group: '行牌与胡牌', risk: '高', keywords: ['自摸', '观战'], scenario: first,
    steps: ['加载后点击自摸', '确认没有提前结束小局；关闭完全控制，观看其他玩家继续'], expectedResults: ['真人106分，其余98分；活跃三人；轮到下家'], manualChecks: ['真人手牌与座位保留', '无日麻下一局弹窗阻塞'], run: 'script', assertion: s => { ensure(s.players.map(p => p.score).join(',') === '106,98,98,98', '平胡自摸金样不符'); ensure(s.phase === 'turn' && s.current === 1, '胡后没有从下家继续'); } };
  const four = { ...presetCases[1], scenario: structuredClone(presetCases[1].scenario) }; four.id = 'XZ-EXCHANGE4'; four.scenario.id = four.id; four.scenario.name = '高级换四张 · 对家交换'; four.scenario.config.rules.exchange = 4; four.scenario.config.rules.direction = 'opposite'; four.scenario.config.ruleId = ruleId(four.scenario.config.rules); four.keywords = ['换四张', '准备'];
  const visual = structuredClone({ ...presetCases[0], assertion: undefined }) as unknown as XzTestCase;
  visual.id = 'XZ-VISUAL'; visual.scenario.id = visual.id; visual.scenario.name = '公共素材与四座视觉'; visual.type = 'visual'; visual.group = '3D与交互'; visual.run = 'script'; visual.assertion = s => assertXzInvariants(s); visual.expectedResults = ['自动部分仅检查场景合法；画面与声音由真人复核'];
  const extra: XzTestCase[] = [];
  const add = (id: string, name: string, group: string, source: XzScenario, expected: string[], execute: (s: XzState) => XzState, assertion: (s: XzState) => void, type: XzTestCase['type'] = 'automatic') => {
    extra.push({ id, version: 1, type, group, risk: '高', keywords: [group], scenario: { ...structuredClone(source), id, name, description: expected.join('；') },
      steps: ['运行自动部分，或加载生产场景后查看规则与账本，按用例预期逐步执行'], expectedResults: expected, manualChecks: type === 'automatic' ? [] : ['核对场景操作、明细、四座和素材'], run: 'script', execute, assertion });
  };
  for (const multiWin of [true, false]) {
    const source = structuredClone(scenario); source.config.rules.multiWin = multiWin; source.config.ruleId = ruleId(source.config.rules);
    add(multiWin ? 'XZ-DOUBLE' : 'XZ-SINGLE', multiWin ? '双响与主动过胡' : '单响距离仲裁', '行牌与胡牌', source, [multiWin ? '下家和对家各收1，上家过；同一窗口结算' : '三家声明只取最近下家；落选者无过胡限制'],
      s => { for (const seat of [1, 2, 3] as Seat[]) s = dispatch(s, seat, multiWin && seat === 3 ? { type: 'pass' } : { type: 'win' }); return s; },
      s => { ensure(s.wins[0].winners.join(',') === (multiWin ? '1,2' : '1'), '仲裁赢家不符'); ensure(s.players.map(p => p.score).join(',') === (multiWin ? '98,101,101,100' : '99,101,100,100'), '独立支付金样不符'); if (!multiWin) ensure(s.players[2].passed === null, '单响落选误算过胡'); }, 'hybrid');
  }
  const kongSource = (hands: number[][]): XzScenario => ({ mode: 'xuezhan', version: 1, id: '', name: '', description: '', seed: 90, config: createConfig({ ...presetRules('dynamic'), firstDealer: 0, rounds: 1 }), initialWall: wallForHands(hands) });
  add('XZ-ANKAN', '暗杠实收与补牌', '杠事务', kongSource([ids('1111'), [], [], []]), ['暗杠后106/98/98/98；墙54张；仅一个杠事务'], s => dispatch(s, 0, legalActions(s, 0).find(a => a.type === 'kan')!), s => { ensure(s.players.map(p => p.score).join(',') === '106,98,98,98' && s.wall.length === 54, '暗杠金样不符'); }, 'hybrid');
  for (const rob of [false, true]) {
    const source = kongSource([[0], [0, 0, 0], ...(rob ? [ids('23 12323456788'), []] : [[], []])]); source.config.rules.passWin = 'off'; source.config.ruleId = ruleId(source.config.rules);
    let pre = createXzMatch(source.config, source.seed, source.initialWall); pre = dispatch(pre, 0, { type: 'discard', tile: pre.players[0].hand.find(t => t.id === 0)!.instanceId }); pre = dispatch(pre, 1, { type: 'pon' }); pre = passAll(pre);
    source.actions = pre.actions.map(a => ({ seat: a.seat, action: a.action }));
    add(rob ? 'XZ-ROB' : 'XZ-ADDED', rob ? '抢补杠取消事务' : '补杠确认后收分', '杠事务', source, [rob ? '可抢才开窗口；被抢不补牌、不收杠分，原碰保留' : '补杠成功，四家99/103/99/99，补一张'], s => { s = dispatch(s, 1, legalActions(s, 1).find(a => a.type === 'kan')!); if (rob) s = dispatch(s, 2, { type: 'win' }); return passAll(s); }, s => { if (rob) ensure(s.ledger.every(e => e.reason !== 'kong') && s.players[1].melds[0].type === 'pon' && s.wins[0].kind === 'rob', '抢杠事务取消失败'); else ensure(s.players.map(p => p.score).join(',') === '99,103,99,99' && s.players[1].melds[0].kanType === 'kakan', '补杠金样不符'); }, 'hybrid');
  }
  const wallSource = kongSource([[...ids('123345789 4567'), 26], ids('669 12345 11224'), ids('22445788 12458'), ids('  1233455677899')]);
  const finalDraw = untilFinalDraw(createXzMatch(wallSource.config, wallSource.seed, wallSource.initialWall)); wallSource.actions = finalDraw.actions.map(a => ({ seat: a.seat, action: a.action }));
  add('XZ-WALL', '最后响应与花猪查叫金样', '墙尽清算', wallSource, ['最后摸牌后仍须弃牌和完成响应；分类听牌/花猪/未听/听牌', '花猪分别付8给其他三家；未听分别付1、4给两家听牌'], s => passAll(dispatch(s, s.current, defaultAction(s, s.current)!)), s => { ensure(s.completed && s.results[0].classifications.join(',') === '听牌,花猪,未听,听牌', '流局分类不符'); ensure(s.players.map(p => p.score).join(',') === '109,76,103,112', '花猪/查叫独立金样不符'); }, 'hybrid');
  add('XZ-CONFIG', '完整快照与依赖拒绝', '配置与兼容', first, ['四预设均可创建，未知版本拒绝；个人偏好不改变计分规则标识'], s => { for (const p of Object.keys(PRESETS) as Preset[]) assertXzInvariants(createXzMatch(createConfig(presetRules(p)), 1)); let rejected = false; try { createConfig({ ...presetRules(), ruleVersion: 9 } as never); } catch { rejected = true; } ensure(rejected, '未知版本未拒绝'); return s; }, assertXzInvariants);
  add('XZ-TIME', '共享时钟准备预算与恢复', '计时与自动操作', presetCases[1].scenario, ['换牌30秒，定缺10秒；独立预算不扣行牌Bank', '暂停/恢复剩余预算，旧时间域无效，退出无定时器'], s => {
    const clock = new ScenarioClock(), runtime = new MatchRuntime(s, xzPolicy, s.config.time, clock);
    try { runtime.activate(); clock.advance(30000); ensure(runtime.state.phase === 'missing', '换牌超时未推进'); clock.advance(10000); ensure(runtime.state.phase === 'turn', '定缺超时未推进'); const id = participantId(runtime.state.current); clock.advance(7000); ensure(runtime.budgetView(id)?.bankMs === 18000, '独立准备消耗Bank'); const saved = saveXz(runtime.state, runtime.pause()); const fresh = new MatchRuntime(replayXz(saved), xzPolicy, s.config.time, clock, 0, saved.runtime); try { fresh.activate(); ensure(fresh.budgetView(id)?.bankMs === 18000, '恢复预算充值'); } finally { fresh.dispose(); } return runtime.state; } finally { runtime.dispose(); ensure(clock.jobs.size === 0, '退出遗留定时器'); }
  }, assertXzInvariants);
  add('XZ-AUTO', '自动和牌优先且仅接受一次', '计时与自动操作', first, ['自动和牌先于摸切；不碰杠不抑制胡；已胡取消决策'], s => { const runtime = new MatchRuntime(s, xzPolicy, s.config.time, new ScenarioClock()); try { runtime.activate(); Object.assign(runtime.preference(participantId(0)), { autoWin: true, suppressCalls: true, autoTsumogiri: true }); runtime.evaluate(); runtime.evaluate(); ensure(!runtime.decision(participantId(0)), '已胡决策未取消'); return runtime.state; } finally { runtime.dispose(); } }, firstCase.assertion);
  add('XZ-AI', '观察隔离与全部难度个性', 'AI', presetCases[2].scenario, ['修改未知牌墙与对手手牌排列不影响观察；全部12种设置合法且确定'], s => { const seat = s.current, before = observeXz(s, seat), hidden = structuredClone(s); hidden.wall.reverse(); hidden.players.filter(p => p.id !== seat).forEach(p => p.hand.reverse()); ensure(JSON.stringify(observeXz(hidden, seat)) === JSON.stringify(before), '观察泄露隐藏变化'); for (const difficulty of ['chikukon', 'shintentai', 'upper', 'kishin'] as const) for (const personality of ['balanced', 'defensive', 'aggressive'] as const) { const a = chooseXzAction(before, { difficulty, personality }); ensure(before.legal.some(v => JSON.stringify(v) === JSON.stringify(a)), 'AI 非法动作'); ensure(JSON.stringify(a) === JSON.stringify(chooseXzAction(before, { difficulty, personality })), 'AI 不确定'); } return s; }, assertXzInvariants);
  add('XZ-REPLAY', '准备和多响逐步确定性回放', '保存与回放', scenario, ['每一步按初始牌墙与权威动作重建；篡改摘要必须拒绝'], s => { for (const seat of [1, 2, 3] as Seat[]) s = dispatch(s, seat, { type: 'win' }); const saved = saveXz(s); for (let i = 0; i <= saved.actions.length; i++) assertXzInvariants(replayXz(saved, i)); let rejected = false; try { replayXz({ ...saved, digest: 'tampered' }); } catch { rejected = true; } ensure(rejected, '篡改存档未拒绝'); return s; }, tripleCase.assertion);
  const nextSource = structuredClone(scenario); nextSource.config = createConfig({ ...nextSource.config.rules, rounds: 2 });
  nextSource.actions!.push(...([1, 2, 3] as Seat[]).map(seat => ({ seat, action: { type: 'win' as const } })));
  add('XZ-NEXT', '完整小局后进入下一局', '准备与完整比赛', nextSource, ['加载时三家已胡，小局结束但比赛未结束', '点击下一局：轮庄下家，四座恢复活跃，积分保留97/101/101/101'], s => dispatch(s, 0, { type: 'next' }), s => { ensure(s.handNumber === 2 && s.dealer === 1 && s.players.every(p => p.won === null), '下一局没有重建四座'); ensure(s.players.map(p => p.score).join(',') === '97,101,101,101', '跨局积分丢失'); }, 'hybrid');
  return [...presetCases, tripleCase, firstCase, four, visual, ...extra];
}
export interface CaseRun { caseId: string; passed: boolean; error?: string; state: XzState; steps: number; elapsedMs: number }
export function runXzCase(test: XzTestCase): CaseRun {
  const start = performance.now(); let state = loadXzScenario(test.scenario), steps = 0;
  try {
    if (test.execute) state = test.execute(state);
    const max = test.run === 'complete' ? test.scenario.config.rules.rounds * 650 : test.id === 'XZ-TRIPLE' ? 3 : test.id === 'XZ-FIRST' ? 1 : 0;
    for (; steps < max && !state.completed; steps++) {
      if (state.phase === 'ended') { state = applyXz(state, 0, { type: 'next' }); continue; }
      const seat = SEATS.find(id => legalActions(state, id).length > 0); if (seat === undefined) throw new Error('没有可推进动作');
      const action = chooseXzAction(observeXz(state, seat), seat ? state.config.ai[seat - 1] : { difficulty: 'shintentai', personality: 'balanced' });
      if (!action) throw new Error('AI 没有返回动作');
      const next = applyXz(state, seat, action); if (next === state) throw new Error('AI 返回非法动作'); state = next; assertXzInvariants(state);
    }
    test.assertion(state); ensure(stateDigest(replayXz(saveXz(state))) === stateDigest(state), '回放不一致');
    return { caseId: test.id, passed: true, state, steps, elapsedMs: performance.now() - start };
  } catch (e) { return { caseId: test.id, passed: false, error: String(e), state, steps, elapsedMs: performance.now() - start }; }
}

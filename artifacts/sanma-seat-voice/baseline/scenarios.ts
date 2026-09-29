import { createSanmaConfig, sanmaFingerprint, type SanmaConfig } from './config';
import { applySanma, createSanma, defaultSanmaAction, legalSanmaActions } from './engine';
import { fixtureTile, sanmaFixture, NORTH_HAND, NORTH_WAIT, NORTH_WAIT_2, NO_YAKU_NORTH_WAIT, ORPHANS_HAND, type SanmaFixture } from './fixtures';
import { assertSanma } from './invariants';
import { scoreSanma, indicators, sanmaPayments } from './scoring';
import { saveSanma, parseSanmaSave, replaySanma } from './persistence';
import { chooseSanmaAction, observeSanma } from './ai';
import { SANMA_SEATS, type SanmaAction, type SanmaSeat, type SanmaState } from './types';
import { MatchRuntime } from '../timeControl/matchRuntime';
import { SanmaTestClock, sanmaPolicy } from './runtime';
import { SANMA_EDGE_CASES } from './edgeScenarios';
import { longRiverFixture } from './visualFixtures';

export interface SanmaCase {
  caseId: string; version: 1; name: string; category: string; description: string; seed: number;
  preconditions: string; steps: string[]; expected: string[]; manualFocus: string[];
  fixture?: SanmaFixture; config?: Partial<Pick<SanmaConfig, 'length' | 'tsumoPolicy'>>;
  run: (state: SanmaState) => SanmaState;
}
export function ensureSanma(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export function caseMove(s: SanmaState, actor: SanmaSeat, action: SanmaAction): SanmaState {
  const next = applySanma(s, actor, action); ensureSanma(next !== s, `拒绝命令 ${actor}:${JSON.stringify(action)}`); assertSanma(next); return next;
}
export function casePass(s: SanmaState): SanmaState {
  for (let i = 0; i < 3 && s.phase === 'response'; i++) {
    const seat = SANMA_SEATS.find(seat => legalSanmaActions(s, seat).some(a => a.type === 'pass'));
    ensureSanma(seat !== undefined, '响应不能终结'); s = caseMove(s, seat, { type: 'pass' });
  }
  return s;
}
const moveType = (s: SanmaState, seat: SanmaSeat, type: SanmaAction['type']) => { const a = legalSanmaActions(s, seat).find(a => a.type === type); ensureSanma(a, `没有合法${type}`); return caseMove(s, seat, a); };
const lowHand = [10, 11, 12, 14, 15, 16, 19, 20, 21, 21, 22, 23, 24, 24];
const scoreFixture = (north: number, current: SanmaSeat = 1): SanmaFixture => ({ current, players: { [current]: { hand: lowHand, north, riichi: north > 0 } }, indicators: [27, 28], interrupted: true });
function define(caseId: string, name: string, category: string, fixture: SanmaFixture | undefined, steps: string[], expected: string[], run: SanmaCase['run'], config?: SanmaCase['config']): SanmaCase {
  return { caseId, version: 1, name, category, description: expected.join('；'), seed: 100, preconditions: '完整108张实体牌及三名玩家；快照载入前校验牌数、阶段、牌实例、点棒与账本。', steps, expected, manualFocus: ['确认操作按钮和权威输出一致', '检查三席身份、牌河、副露与拔北区'], fixture, run, config };
}
export const SANMA_CASES: SanmaCase[] = [
  ...SANMA_EDGE_CASES,
  define('SM-01-EAST', '正式三人东配置与普通摸切', '入口与骨架', undefined, ['从正式菜单选择三人东', '进入测试后单步推进'], ['三名真实玩家、东一开局、108张、余牌54'], s => { ensureSanma(s.wall.live.length === 54 && s.players.length === 3 && s.roundWind === 'east' && s.handNumber === 1, '开局不符'); return caseMove(s, 0, defaultSanmaAction(s, 0)!); }, { length: 'east-only' }),
  define('SM-01-SOUTH', '正式三人南与无自摸损', '入口与骨架', undefined, ['从正式菜单选择三人南、无自摸损', '确认从东一开始'], ['东南战仍从东一开始；规则快照记录无损'], s => { ensureSanma(s.config.length === 'hanchan' && s.config.tsumoPolicy === 'split_missing_share_ceil100' && s.roundWind === 'east', '配置不符'); return caseMove(s, 0, defaultSanmaAction(s, 0)!); }, { length: 'hanchan', tsumoPolicy: 'split_missing_share_ceil100' }),
  define('SM-02-IDENTITY', '三席身份与牌库守恒', '入口与骨架', undefined, ['检查三席和牌库诊断', '出一张牌'], ['北风牌不是第四位玩家；无二至八万'], s => { assertSanma(s); ensureSanma(!s.wall.tiles.some(t => t.id > 0 && t.id < 8), '牌库污染'); return caseMove(s, 0, defaultSanmaAction(s, 0)!); }),
  define('SM-03-PON', '禁吃与碰后必须弃牌', '碰杠与牌墙', { current: 1, players: { 0: { hand: [31, 31, 30, 9, 10, 11, 18, 19, 20, 23, 24, 27, 27] }, 1: { hand: [31, 9, 12, 15, 18, 21, 24, 27, 28, 29, 30, 32, 33, 0] } } }, ['观察席切换电脑一，弃白', '切回真人，碰；确认不能立即拔北'], ['Rules拒绝Chi；碰后无drawn且只能合法弃牌'], s => { ensureSanma(applySanma(s, 0, { type: 'chi' } as unknown as SanmaAction) === s, '允许吃'); s = caseMove(s, 1, { type: 'discard', tile: fixtureTile(s, 1, 31) }); s = moveType(s, 0, 'pon'); s = casePass(s); ensureSanma(s.current === 0 && s.players[0].drawn === null && !legalSanmaActions(s, 0).some(a => a.type === 'north'), '碰后状态不符'); return caseMove(s, 0, defaultSanmaAction(s, 0)!); }),
  define('SM-04-NORTH', '单次拔北', '拔北', { players: { 0: { hand: NORTH_HAND } }, replacements: [25] }, ['点击拔北', '检查拔北区及摸入牌'], ['原北instanceId进入拔北区；补牌来源north；不翻杠宝牌'], s => { const n = casePass(moveType(s, 0, 'north')); ensureSanma(n.players[0].north.length === 1 && n.kanCount === 0 && indicators(n).length === 1, '拔北不符'); return n; }),
  define('SM-04-CHAIN', '连续拔北至四张', '拔北', { players: { 0: { hand: [...NORTH_HAND.slice(0, 10), 30, 30, 30, 30] } }, replacements: [27, 28, 29, 31] }, ['连续执行4次拔北，处理合法响应'], ['四张北保留原身份；只消耗四次补牌；仍未副露'], s => { for (let i = 0; i < 4; i++) s = casePass(moveType(s, 0, 'north')); ensureSanma(s.players[0].north.length === 4 && s.wall.replacementCount === 4 && s.kanCount === 0, '连续拔北错误'); return s; }),
  define('SM-05-KEEP', '保留北作国士／正常弃北', '拔北', { players: { 0: { hand: [...ORPHANS_HAND, 0] } } }, ['查看北可保留', '关闭自动操作，选择正常弃北'], ['北可作为国士组成牌；弃北进入河而非拔北区'], s => { ensureSanma(legalSanmaActions(s, 0).some(a => a.type === 'tsumo'), '国士不合法'); s = caseMove(s, 0, { type: 'discard', tile: fixtureTile(s, 0, 30) }); ensureSanma(s.players[0].north.length === 0 && s.players[0].river.some(r => s.wall.tiles[r.index].id === 30), '北归属不符'); return s; }),
  define('SM-06-ROB', '合法抢北单响', '抢北', { players: { 0: { hand: NORTH_HAND }, 1: { hand: NORTH_WAIT }, 2: { hand: NO_YAKU_NORTH_WAIT } } }, ['真人拔北', '切换电脑一，荣和'], ['有役者可抢北；无役者不获得Ron；不补牌不加拔北'], s => { s = moveType(s, 0, 'north'); s = moveType(s, 1, 'ron'); s = casePass(s); ensureSanma(s.result?.winners.length === 1 && s.players[0].north.length === 0 && s.wall.replacementCount === 0, '抢北错误'); return s; }),
  define('SM-06-DOUBLE', '抢北双响原子结算', '抢北', { players: { 0: { hand: NORTH_HAND }, 1: { hand: NORTH_WAIT }, 2: { hand: NORTH_WAIT_2 } }, honba: 2, pot: 1000 }, ['真人拔北', '电脑二先荣和，再电脑一荣和'], ['收齐才结算；本场和供托只给电脑一'], s => { s = moveType(s, 0, 'north'); s = moveType(s, 2, 'ron'); ensureSanma(!s.result, '响应未齐提前结算'); s = moveType(s, 1, 'ron'); ensureSanma(s.result?.winners.length === 2 && s.ledger.filter(e => e.reason === 'honba').every(e => e.to === 1), '双响分配错误'); return s; }),
  define('SM-06-NOYAKU', '无役与振听拒绝抢北', '抢北', { players: { 0: { hand: NORTH_HAND }, 1: { hand: NO_YAKU_NORTH_WAIT }, 2: { hand: NORTH_WAIT_2, temporaryFuriten: true } } }, ['真人拔北', '确认没有无资格的响应等待'], ['无额外抢杠役；两家不具资格时立即补牌'], s => { s = moveType(s, 0, 'north'); ensureSanma(s.phase === 'turn' && !s.players[1].temporaryFuriten, '无役被误判为放过和牌'); return s; }),
  define('SM-07-FURITEN', '放过抢北与立直振听', '立直与首巡', { players: { 0: { hand: NORTH_HAND }, 1: { hand: NORTH_WAIT, riichi: true, ippatsu: true }, 2: { hand: NORTH_WAIT_2 } } }, ['真人拔北', '其余两家都选择过'], ['电脑一永久振听，电脑二临时振听；成立时全桌一发打断'], s => { s = casePass(moveType(s, 0, 'north')); ensureSanma(s.players[1].permanentFuriten && s.players[2].temporaryFuriten && s.players.every(p => !p.ippatsu), '振听或一发错误'); return s; }),
  define('SM-07-RINSHAN', '立直拔摸入北，补北岭上', '立直与首巡', { players: { 0: { hand: NORTH_HAND, riichi: true, ippatsu: true } }, replacements: [25], liveCount: 1, drainTo: [1, 2] }, ['拔北', '点击自摸'], ['补北岭上；无海底、无一发；等待不变'], s => { s = casePass(moveType(s, 0, 'north')); s = moveType(s, 0, 'tsumo'); const yaku = s.result!.winners[0].score.yaku.map(y => y.id); ensureSanma(yaku.includes('rinshan-kaihou') && !yaku.includes('haitei') && !yaku.includes('ippatsu'), '补北上下文错误'); return s; }),
  define('SM-08-DORA', '西指北、拔北、里宝牌叠加', '宝牌', { players: { 0: { hand: lowHand, north: 2, riichi: true } }, indicators: [29, 29] }, ['点击自摸', '展开宝牌分项'], ['拔北2、普通宝牌2、里宝牌2独立显示'], s => { s = moveType(s, 0, 'tsumo'); const sc = s.result!.winners[0].score; ensureSanma(sc.northDora === 2 && sc.dora === 2 && sc.uraDora === 2, '宝牌叠加错误'); return s; }),
  define('SM-09-ANKAN', '暗杠补牌与资源归属', '碰杠与牌墙', { players: { 0: { hand: [9, 9, 9, 9, 12, 13, 14, 18, 19, 20, 23, 24, 27, 27] } } }, ['点击暗杠', '检查副露、宝牌与补牌'], ['暗杠增加一杠，指示牌2张；真实补牌'], s => { s = casePass(moveType(s, 0, 'ankan')); ensureSanma(s.kanCount === 1 && indicators(s).length === 2 && s.players[0].drawOrigin === 'kan', '暗杠错误'); return s; }),
  define('SM-09-EMPTY', '墙尽禁止拔北与杠', '碰杠与牌墙', { players: { 0: { hand: NORTH_HAND } }, liveCount: 0 }, ['确认拔北不可用', '正常弃牌，处理响应'], ['没有合法补牌资源，不提供补牌动作'], s => { ensureSanma(!legalSanmaActions(s, 0).some(a => ['north', 'ankan', 'kakan'].includes(a.type)), '资源耗尽仍可补牌'); return casePass(caseMove(s, 0, defaultSanmaAction(s, 0)!)); }),
  ...(['loss', 'split_missing_share_ceil100'] as const).flatMap(policy => [
    define(`SM-10-LOW-${policy === 'loss' ? 'LOSS' : 'FULL'}`, `闲家30符2番 · ${policy === 'loss' ? '有损' : '无损'}`, '自摸支付', scoreFixture(0), ['切换观察席至电脑一', '点击自摸，查看逐笔账本'], [policy === 'loss' ? '庄付1000、另一闲家付500' : '庄付1300、另一闲家付800'], s => { s = moveType(s, 1, 'tsumo'); const w = s.result!.winners[0]; ensureSanma(w.score.han === 2 && w.score.fu === 30, `应为30符2番，实际${w.score.han}/${w.score.fu}`); ensureSanma(s.players[0].score === 35000 - (policy === 'loss' ? 1000 : 1300) && s.players[2].score === 35000 - (policy === 'loss' ? 500 : 800), '低番支付错误'); return s; }, { tsumoPolicy: policy }),
    define(`SM-10-MANGAN-${policy === 'loss' ? 'LOSS' : 'FULL'}`, `闲家满贯 · ${policy === 'loss' ? '有损' : '无损'}`, '自摸支付', scoreFixture(2), ['电脑一自摸', '检查付款'], [policy === 'loss' ? '庄4000、闲2000' : '庄5000、闲3000'], s => { s = moveType(s, 1, 'tsumo'); ensureSanma(s.result!.winners[0].score.han === 5, '不是5番样例'); ensureSanma(s.players[0].score === 35000 - (policy === 'loss' ? 4000 : 5000) && s.players[2].score === 35000 - (policy === 'loss' ? 2000 : 3000), '满贯支付错误'); return s; }, { tsumoPolicy: policy }),
    define(`SM-10-DEALER-${policy === 'loss' ? 'LOSS' : 'FULL'}`, `庄家满贯 · ${policy === 'loss' ? '有损' : '无损'}`, '自摸支付', scoreFixture(2, 0), ['真人自摸', '检查两闲支付'], [policy === 'loss' ? '两闲各4000' : '两闲各6000'], s => { s = moveType(s, 0, 'tsumo'); ensureSanma(s.players.slice(1).every(p => p.score === 35000 - (policy === 'loss' ? 4000 : 6000)), '庄家支付错误'); return s; }, { tsumoPolicy: policy }),
    define(`SM-10-HANEMAN-${policy === 'loss' ? 'LOSS' : 'FULL'}`, `闲家跳满 · ${policy === 'loss' ? '有损' : '无损'}`, '自摸支付', scoreFixture(3), ['电脑一自摸', '检查付款'], [policy === 'loss' ? '庄6000、闲3000' : '庄7500、闲4500'], s => { s = moveType(s, 1, 'tsumo'); ensureSanma(s.players[0].score === 35000 - (policy === 'loss' ? 6000 : 7500) && s.players[2].score === 35000 - (policy === 'loss' ? 3000 : 4500), '跳满支付错误'); return s; }, { tsumoPolicy: policy }),
  ]),
  define('SM-11-HONBA', '本场与供托单独入账', '结算', { ...scoreFixture(0), honba: 2, pot: 1000 }, ['电脑一自摸', '检查基础、各家本场、供托分开'], ['本场两家各200；供托1000只领取一次'], s => { s = moveType(s, 1, 'tsumo'); ensureSanma(s.pot === 0 && s.ledger.filter(e => e.reason === 'honba').length === 2 && s.ledger.filter(e => e.reason === 'sticks').length === 1, '本场供托错误'); return s; }),
  define('SM-12-ABORT', '九种九牌', '流局', { players: { 0: { hand: [...ORPHANS_HAND, 0] } }, interrupted: false }, ['点击九种九牌', '点击下一局'], ['途中流局连庄，本场+1'], s => { s.players.forEach(p => { p.discards = 0; }); s = moveType(s, 0, 'abort'); s = moveType(s, 0, 'next'); ensureSanma(s.honba === 1 && s.handNumber === 1, '九种九牌推进错误'); return s; }),
  define('SM-13-EAST-END', '东三常规终局', '比赛结束', { ...scoreFixture(2, 0), handNumber: 3, scores: [39000, 33000, 33000] }, ['真人自摸', '检查和了止与三列排名'], ['东三庄家第一达目标，和了止'], s => { s = moveType(s, 0, 'tsumo'); ensureSanma(s.completed && s.endReason === '和了止' && s.ranking.length === 3, '东三终局错误'); return s; }, { length: 'east-only' }),
  define('SM-13-SOUTH-END', '南三常规终局', '比赛结束', { ...scoreFixture(2, 0), roundWind: 'south', handNumber: 3, scores: [39000, 33000, 33000] }, ['真人自摸', '查看南三结果'], ['三人南在南三按末庄规则结束'], s => { s = moveType(s, 0, 'tsumo'); ensureSanma(s.completed, '南三未结束'); return s; }, { length: 'hanchan' }),
  define('SM-13-EXTEND', '东三无人达标，南入', '比赛结束', { ...scoreFixture(0), handNumber: 3 }, ['电脑一自摸', '下一局'], ['无人达40000时进入南一，不按三局硬停止'], s => { s = moveType(s, 1, 'tsumo'); ensureSanma(!s.completed, '提前结束'); s = moveType(s, 0, 'next'); ensureSanma(s.roundWind === 'south' && s.handNumber === 1 && s.dealer === 1, '南入错误'); return s; }),
  define('SM-13-MIDTARGET', '中途40000不误结束', '比赛结束', { ...scoreFixture(2, 0), scores: [39000, 33000, 33000] }, ['东一庄家自摸'], ['虽然超过40000，东一仍继续比赛'], s => { s = moveType(s, 0, 'tsumo'); ensureSanma(!s.completed && s.players[0].score > 40000, '中途目标误终局'); return s; }),
  define('SM-14-TIME', '权威超时摸切及旧命令拒绝', '计时与自动操作', { players: { 0: { hand: NORTH_HAND } } }, ['测试时钟每次＋5秒，推进至25秒', '检查真实摸入北被弃出'], ['基础5秒＋Bank20秒后摸切；不会自动拔北'], s => {
    const clock = new SanmaTestClock(), runtime = new MatchRuntime(s, sanmaPolicy, s.config.time, clock); runtime.activate();
    const old = runtime.decision('sanma:0')!.id, drawn = s.players[0].drawn;
    clock.advance(25000); ensureSanma(runtime.state.players[0].river.some(r => r.index === drawn) && runtime.state.players[0].north.length === 0, '超时不是真实摸切');
    ensureSanma(!runtime.command('sanma:0', old, current => applySanma(current, 0, defaultSanmaAction(current, 0)!)), '旧决策被接受');
    const result = runtime.state; runtime.dispose(); return result;
  }),
  define('SM-14-NORTH-BUDGET', '连续拔北不赠时间', '计时与自动操作', { players: { 0: { hand: [...NORTH_HAND.slice(0, -2), 30, 30] } }, replacements: [27, 28] }, ['测试时钟＋5秒', '连续拔北，查看剩余Bank'], ['不重新获得同回合基础时间，响应期间原玩家预算挂起'], s => {
    const clock = new SanmaTestClock(), runtime = new MatchRuntime(s, sanmaPolicy, s.config.time, clock); runtime.activate(); clock.advance(6000);
    const a = legalSanmaActions(runtime.state, 0).find(a => a.type === 'north')!;
    runtime.command('sanma:0', runtime.decision('sanma:0')!.id, current => applySanma(current, 0, a));
    if (runtime.state.phase === 'response') for (const id of [1, 2] as const) { const d = runtime.decision(`sanma:${id}`); if (d) runtime.command(d.participantId, d.id, current => applySanma(current, id, { type: 'pass' })); }
    ensureSanma(runtime.budgetView('sanma:0')?.baseMs === 0 && runtime.budgetView('sanma:0')?.bankMs === 19000, '拔北赠时');
    const result = runtime.state; runtime.dispose(); return result;
  }),
  define('SM-15-RESTORE', '抢北响应保存恢复', '保存与回放', { players: { 0: { hand: NORTH_HAND }, 1: { hand: NORTH_WAIT }, 2: { hand: NORTH_WAIT_2 } } }, ['拔北后保存退出', '恢复原支付策略及响应'], ['响应存档恢复不发补牌，已响应者不重复结算'], s => { const initial = s; s = moveType(s, 0, 'north'); s = moveType(s, 2, 'ron'); const save = parseSanmaSave(JSON.stringify(saveSanma(s, undefined, initial, true))); s = replaySanma(save); return moveType(s, 1, 'ron'); }),
  define('SM-16-REPLAY', '拔北与和牌确定性回放', '保存与回放', { players: { 0: { hand: NORTH_HAND } }, replacements: [25] }, ['拔北后自摸', '规则与账本中从头回放，逐步／快进／跳转'], ['相同命令重建相同实体状态与账本，不再次运行AI'], s => { const initial = s; s = casePass(moveType(s, 0, 'north')); s = moveType(s, 0, 'tsumo'); const save = saveSanma(s, undefined, initial, true); ensureSanma(sanmaFingerprint(replaySanma(save)) === sanmaFingerprint(s), '回放不确定'); return s; }),
  define('SM-17-AI', 'AI信息边界与合法拔北', 'AI', { players: { 0: { hand: NORTH_HAND } } }, ['运行自动检查', '单步观察AI合法决策'], ['隐藏牌置换不改变相同Observation决策'], s => { const before = observeSanma(s, 0), a = chooseSanmaAction(before); const changed = structuredClone(s); [changed.wall.tiles[changed.wall.live[0]], changed.wall.tiles[changed.wall.live[1]]] = [changed.wall.tiles[changed.wall.live[1]], changed.wall.tiles[changed.wall.live[0]]]; ensureSanma(JSON.stringify(before) === JSON.stringify(observeSanma(changed, 0)) && JSON.stringify(a) === JSON.stringify(chooseSanmaAction(observeSanma(changed, 0))), 'AI读取隐藏信息'); ensureSanma(a, 'AI没有动作'); return caseMove(s, 0, a); }),
  define('SM-18-LONG-RIVER', '合法行牌形成的长牌河', '视觉与生命周期', undefined, ['分别检查1280×720及1920×1080', '切换观察席，反复退出重入', '四北与四杠另载SM-09-EIGHT并拔出剩余两北'], ['通过真实摸切和碰形成超过18张的牌河；保留完整动作前缀；没有虚构连续弃牌'], s => { ensureSanma(s.players.some(p => p.river.filter(r => !r.claimed).length > 18) && s.actions.length > 0, '长河场景不足'); replaySanma(saveSanma(s)); return s; }),
];
export function loadSanmaCase(t: SanmaCase, config = createSanmaConfig(), seed = t.seed): SanmaState {
  const c = { ...config, ...(t.config ?? {}) };
  const s = t.caseId === 'SM-18-LONG-RIVER' ? longRiverFixture(c, seed) : t.fixture ? sanmaFixture(t.fixture, c, seed) : createSanma(c, seed);
  if (t.caseId === 'SM-12-ABORT') s.players.forEach(p => { p.discards = 0; });
  assertSanma(s); return s;
}
export function runSanmaCase(t: SanmaCase, config = createSanmaConfig(), seed = t.seed) {
  let state = loadSanmaCase(t, config, seed); const initial = state;
  try { state = t.run(state); assertSanma(state); return { passed: true, state, initial, expected: t.expected, actual: { phase: state.phase, scores: state.players.map(p => p.score), result: state.result?.reason, sequence: state.sequence }, error: undefined }; }
  catch (e) { return { passed: false, state, initial, expected: t.expected, actual: { phase: state.phase, scores: state.players.map(p => p.score), sequence: state.sequence }, error: String(e) }; }
}

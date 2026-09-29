import type { XzRules } from './config';
export interface RuleField { key: keyof XzRules; group: string; label: string; help: string; options?: Array<readonly [string | number, string]> }
export const RULE_FIELDS: RuleField[] = [
  { key: 'rounds', group: '比赛', label: '比赛小局数', help: '固定小局数；1–64 局。' },
  { key: 'startingScore', group: '比赛', label: '起始积分', help: '四家相同；0–1000000 分。' },
  { key: 'bankruptcy', group: '比赛', label: '完整小局结算后破产结束', help: '关闭允许负分；开启在整副账本结清后检查负分。' },
  { key: 'firstDealer', group: '比赛', label: '首庄', help: '随机由固定种子决定。', options: [[-1, '随机'], [0, '你'], [1, '下家'], [2, '对家'], [3, '上家']] },
  { key: 'dealerPolicy', group: '比赛', label: '后续庄家', help: '首胡多人同响时，该次出牌者坐庄。', options: [['rotate', '轮庄'], ['first-win', '首胡坐庄']] },
  { key: 'drawDealer', group: '比赛', label: '无首胡流局庄家', help: '墙尽且未按首胡定庄时适用。', options: [['stay', '连庄'], ['rotate', '轮庄']] },
  { key: 'exchange', group: '准备', label: '换牌', help: '所有人提交后同色牌原子交换；换四张为高级变体。', options: [[0, '不换'], [3, '同色换三张'], [4, '同色换四张']] },
  { key: 'direction', group: '准备', label: '交换方向', help: '顺时针为下一座，逆时针为上一座；随机每局固定。', options: [['random', '随机'], ['clockwise', '顺时针'], ['counterclockwise', '逆时针'], ['opposite', '对家']] },
  { key: 'missing', group: '准备', label: '缺门方式', help: '自由模式无定缺阶段，但每次胡牌仍须缺一门。', options: [['declared', '开局定缺'], ['dynamic', '自由打缺']] },
  { key: 'unclearedCalls', group: '准备', label: '持缺牌时允许碰杠其他门', help: '指定缺门本身永远不能碰杠；有缺牌必须先打缺牌。' },
  { key: 'selfDrawOnly', group: '胡牌响应', label: '仅自摸', help: '开启后须关闭多响、过手胡及抢补杠。' },
  { key: 'multiWin', group: '胡牌响应', label: '一炮多响', help: '关闭只取出牌者下家起最近赢家；落选不算过胡。' },
  { key: 'passWin', group: '胡牌响应', label: '过手胡', help: '本人实际摸牌解除；碰牌不解除；按已放弃基值比较。', options: [['off', '关闭'], ['until-draw', '摸牌前禁止接炮'], ['higher', '仅可接更高基值']] },
  { key: 'robKong', group: '胡牌响应', label: '允许抢补杠', help: '只抢补杠；被抢不收该笔杠分、不补牌。' },
  { key: 'base', group: '计分', label: '底分', help: '平胡 0 番：点炮付一底；默认自摸每家付二底。' },
  { key: 'cap', group: '计分', label: '番数封顶', help: '基值＝底分×2的番数次方。三番底分1时基值8。', options: [[2, '2 番'], [3, '3 番'], [4, '4 番'], [5, '5 番'], [6, '6 番'], [0, '不封顶']] },
  { key: 'selfDraw', group: '计分', label: '自摸附加方式', help: '三番封顶加1底为9；封顶后加1番为16。', options: [['none', '不附加'], ['base', '加底'], ['fan', '加番']] },
  { key: 'selfDrawExtra', group: '计分', label: '自摸附加数值', help: '0–3 个底或番；仅自摸适用。' },
  { key: 'extraAfterCap', group: '计分', label: '自摸加番在封顶后附加', help: '关闭时自摸附加番也参与封顶。' },
  { key: 'kongPay', group: '杠分', label: '杠分', help: '关闭时须关闭退税和呼叫转移；仍可合法开杠。' },
  { key: 'directPay', group: '杠分', label: '直杠支付对象', help: '只计当时活跃玩家。', options: [['source', '放杠者支付'], ['active', '其他活跃者各付']] },
  { key: 'directRate', group: '杠分', label: '直杠底分倍数', help: '默认放杠者付2底。' },
  { key: 'addedRate', group: '杠分', label: '补杠底分倍数', help: '默认其他活跃者各付1底。' },
  { key: 'concealedRate', group: '杠分', label: '暗杠底分倍数', help: '默认其他活跃者各付2底。' },
  { key: 'directResponsibility', group: '杠分', label: '点杠花由放杠者包赔', help: '放杠者付全部其他活跃者本应支付的总额，非固定三倍。' },
  { key: 'transfer', group: '杠分', label: '呼叫转移', help: '成功杠补牌直接弃牌放炮，仅转最近一笔杠实收额。' },
  { key: 'transferSplit', group: '杠分', label: '多赢家转移分配', help: '均分余数按出牌者下家起的赢家顺序补1分。', options: [['nearest', '最近赢家收取'], ['equal', '均分']] },
  { key: 'pig', group: '墙尽清算', label: '查花猪', help: '定缺未清指定门，或自由模式三门俱全。' },
  { key: 'pigPenalty', group: '墙尽清算', label: '花猪罚分方式', help: '胡分不封顶时，必须使用有限固定倍数。', options: [['cap', '封顶基值'], ['fixed', '固定底分倍数']] },
  { key: 'pigRate', group: '墙尽清算', label: '花猪固定倍数', help: '每位合格收款者收取；1–1024 底。' },
  { key: 'pigIncludesWon', group: '墙尽清算', label: '花猪收款对象包含已胡者', help: '已胡者退出普通支付，仍可获得该项清算。' },
  { key: 'readyPay', group: '墙尽清算', label: '查叫', help: '未听者赔给未胡且合格听牌者的最高合法基值。' },
  { key: 'readyPolicy', group: '墙尽清算', label: '听牌口径', help: '公开耗尽只看本人和公开牌；不读取牌墙及对手暗牌。', options: [['structural', '结构听'], ['public', '排除公开已耗尽待牌']] },
  { key: 'pigAlsoReady', group: '墙尽清算', label: '花猪叠加查叫', help: '默认花猪不重复赔查叫。' },
  { key: 'refund', group: '墙尽清算', label: '杠分退税', help: '逐笔返还原付款者（含已胡者）；已转移收入不重复退还。', options: [['off', '关闭'], ['not-ready', '未胡未听者退'], ['all-unwon', '全部未胡者退']] },
];
export function disabledReason(key: keyof XzRules, r: XzRules): string | null {
  if (key === 'direction' && !r.exchange) return '不换牌时不适用';
  if (key === 'unclearedCalls' && r.missing === 'dynamic') return '自由打缺没有指定缺门';
  if (['multiWin', 'passWin', 'robKong'].includes(key) && r.selfDrawOnly) return '仅自摸时停用';
  if (['directPay', 'directRate', 'addedRate', 'concealedRate', 'transfer', 'transferSplit', 'refund'].includes(key) && !r.kongPay) return '关闭杠分时停用';
  if (key === 'transferSplit' && !r.transfer) return '未开启呼叫转移';
  if (['pigPenalty', 'pigRate', 'pigIncludesWon'].includes(key) && !r.pig) return '未开启查花猪';
  if (key === 'pigRate' && r.pigPenalty !== 'fixed') return '仅固定罚分使用';
  if (['readyPolicy', 'pigAlsoReady'].includes(key) && !r.readyPay) return '未开启查叫';
  if (key === 'selfDrawExtra' && r.selfDraw === 'none') return '自摸不附加';
  if (key === 'extraAfterCap' && (r.selfDraw !== 'fan' || !r.cap)) return '仅自摸加番且封顶时适用';
  return null;
}

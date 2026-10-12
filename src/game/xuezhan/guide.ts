import { PATTERNS, presetRules, type Pattern, type XzConfig } from './config';
import type { WinContext } from './types';
import type { GuideYakuExample } from '../rulesGuide/yakuCatalog';
import { createTile } from '../tileUtils';
import type { CallSet, TileId } from '../types';

export const XZ_GUIDE_TABS = { basics: '从零开始', flow: '一局流程', missing: '缺门与胡牌', scoring: '番数与支付', patterns: '全部番型', settlement: '杠与墙尽清算', faq: '常见问题' };
export type XzGuideTab = keyof typeof XZ_GUIDE_TABS;
export const BASIC_HAND = [0,1,2,3,4,5,9,10,11,15,16,17,22,22];
// A complete two-suit ordinary hand, with no default reward.
export const PLAIN_HAND = [0,1,2,3,4,5,9,10,11,15,16,17,13,13];
export const PURE_HAND = [0,1,2,3,4,5,6,7,8,1,2,3,4,4];
export function guideExample(ids: number[], note: string, melds: CallSet[] = []): GuideYakuExample {
  return { hand: ids.slice(0,-1).map(id => ({id:id as TileId})), winningTile: { id: ids[ids.length-1] as TileId }, melds, note };
}
function pon(id: number): CallSet { return { type: 'pon', from: 1, opened: true, tiles: [0,1,2].map(i => ({...createTile(id as TileId,i),red:false,instanceId:`guide-pon-${id}-${i}`})) }; }
export interface XzPatternGuide { id: Pattern; plain: string; condition: string; combination: string; example: GuideYakuExample; context: WinContext }
const shape = (id: Pattern, plain: string, ids: number[], combination: string, melds: CallSet[] = []): XzPatternGuide => ({id,plain,condition:'完整胡牌张数成立，缺条；普通弃牌胡，无额外事件。',combination,example:guideExample(ids,'牌例包含最后一张胡牌来源；缺条。',melds),context:{kind:'discard'}});
const event = (id: Pattern, plain: string, condition: string, context: WinContext): XzPatternGuide => ({id,plain,condition,combination:'只在这次真实事件成立时加番，可与牌型奖励组合；查叫不假设此事件。',example:guideExample(PLAIN_HAND,condition),context});
export const XZ_PATTERN_GUIDE: XzPatternGuide[] = [
  shape('allTriplets','四组都是三张一样的刻子或四张一样的杠，再加一对将。自己摸成也算，不必碰出来。',[0,0,0,3,3,3,9,9,9,12,12,12,16,16],'可叠加清一色、根等；清对只是清一色＋大对子，不另加一次。'),
  shape('pure','整手包括已经碰杠的牌和胡牌张，都只有一种花色。',PURE_HAND,'可与大对子或七对组合；清七对是清一色＋七对。'),
  shape('sevenPairs','没有副露，14张正好组成七对。四张同牌可算两对。',[0,0,2,2,4,4,6,6,9,9,12,12,16,16],'和普通四面子拆分择优，不把两个拆分相加；关闭此项会关闭特殊七对胡形，但仍可按普通胡形判断。'),
  shape('root','完整胡牌结构中，某种牌的四张都在自己这一手里，每种计一根；开杠不是必须。',[0,0,0,0,1,2,9,10,11,12,13,14,16,16],'同种四张只计一次；龙七对是七对带根的名称，不重复加番。'),
  event('kongDraw','杠成功后补到的那张牌立即自摸。','成功暗杠、直杠或补杠之后，直接补牌自摸；此手牌例是在杠事件完成后的合法胡形示意。',{kind:'draw',kong:true}),
  event('kongDiscard','某人杠成功补牌后，紧接着打出的牌让你胡。','他家成功杠后直接弃出胡牌张；与转移杠收入是两个独立项目。',{kind:'discard',kong:true}),
  event('robKong','别人把已碰的三张补成杠时，你用第四张胡牌。','仅补杠窗口；允许抢补杠是资格开关，本项仅控制抢杠奖励。',{kind:'rob'}),
  event('lastDraw','摸到最后一张墙牌，立即自摸。','此次摸牌把墙摸空，直接自摸；不是“牌墙快没了”就算。',{kind:'draw',last:true}),
  event('lastDiscard','最后一张墙牌摸入后，直接打出的那张被你胡。','最后实体墙牌的直接弃牌响应窗口。',{kind:'discard',last:true}),
  shape('concealed','没有碰、直杠或补杠；暗杠仍保留门清。',PLAIN_HAND,'点炮、自摸均可；不是只有自摸才能门清。'),
  shape('middle','所有手牌、副露、胡牌张都不是一或九。',[1,2,3,3,4,5,10,11,12,13,14,15,16,16],'可与其他成立的牌型组合；关闭中张奖励不禁止用这些牌胡。'),
  shape('singlePair','已经有四副碰杠（含暗杠），最后剩一张，凑成一对将牌胡。',[16,16],'会同时符合大对子（若开启）；这里的番值是额外奖励，不能把“合计两番”再加一次。',[pon(0),pon(3),pon(9),pon(12)]),
  shape('jiang','普通四面子加将，所有牌的数字只能是二、五、八。',[1,1,1,4,4,4,10,10,10,16,16,16,7,7],'普通拆分成立才算；不会因为七对全是二五八就额外认定将对。'),
  shape('terminals','在同一个普通拆分中，每组面子和将牌都含一或九。',[0,1,2,6,7,8,9,10,11,15,16,17,0,0],'必须存在完整符合条件的拆分；不能只因手里有一九就加番。'),
  event('heaven','准备阶段结束后，庄家起手就能胡，尚未打出第一张。','庄家起手自摸，换牌/定缺已按本场设置完成，尚未发生弃牌。',{kind:'draw',heaven:true}),
  event('earth','无人碰杠打断前，闲家胡庄家的第一张弃牌。','赢家不是庄家；庄家第一张弃牌且没有碰杠打断。',{kind:'discard',earth:true}),
];
// Successful kong-draw example includes the actual declared kong (15 physical tiles).
XZ_PATTERN_GUIDE.find(p=>p.id==='kongDraw')!.example = guideExample(
  [3,4,5,9,10,11,15,16,17,13,13], '刚暗杠一万后从墙补入五筒，立即自摸；缺条。',
  [{type:'kan',kanType:'ankan',opened:false,from:0,tiles:[0,1,2,3].map(i=>({...createTile(0,i),red:false}))}],
);

export const GUIDE_GOLDENS = [
  {name:'A 平胡自摸，四人仍在行牌',hand:PLAIN_HAND,kind:'draw' as const,fan:0,base:1,payment:2,payers:'B、C、D 各付2',net:[6,-2,-2,-2]},
  {name:'B 清一色点炮胡，由C放炮',hand:PURE_HAND,kind:'discard' as const,fan:2,base:4,payment:4,payers:'只有C向B付4；A、D不付',net:[0,4,-4,0]},
  {name:'B 清一色自摸，A已经胡牌',hand:PURE_HAND,kind:'draw' as const,fan:2,base:4,payment:5,payers:'C、D 各向B付5；A不付',net:[0,10,-5,-5]},
];
export const GUIDE_EXAMPLE_RULES = presetRules('declared');

export function xzGuideParagraphs(tab: Exclude<XzGuideTab,'patterns'>, c: XzConfig): string[] {
  const r=c.rules;
  switch(tab) {
    case 'basics': return [
      '血战到底按整场净积分排名。先胡只是先退出本小局行牌，不等于最后分数第一。桌上一直保留四个座位。',
      '牌库有万、筒、条三门，每门一到九各4张，共108张；没有字牌或花牌。牌面“索”就是“条”。三张同门连续数字叫顺子，三张一样叫刻子，四张一样叫杠，两张一样叫对子（将）。',
      '普通胡形是四个面子加一个对子；面子可以是顺子、刻子或杠。不能“吃”是不能拿别人的弃牌组顺子，自己摸成的顺子仍能胡。每开一个杠实体牌多一张，所以不要把全部实体牌都机械数成14张。',
      '下方合法例为123万、456万、123筒、789筒、55筒（缺条），满足四面子一对。反例把55筒改为55条后虽然形状相同，却三门俱全，不能胡；定缺条时也尚未清缺。',
      `七对是另一种特殊胡形，必须无副露；本场${r.patterns.sevenPairs.enabled?'允许':'不允许'}特殊七对。其余多数番型开关只影响奖励，不影响普通合法胡形资格。`,
    ];
    case 'flow': return [
      `本场共${r.rounds}小局，每人起始${r.startingScore}积分；庄家14张，其余13张。${r.firstDealer<0?'首庄随机确定。':`首庄为${['你','下家','对家','上家'][r.firstDealer]}。`}`,
      r.exchange ? `先同色换${r.exchange}张：选择同门的${r.exchange}张提交，所有人提交后一起交换。方向：${{random:'每局随机固定',clockwise:'顺时针（下一座）',counterclockwise:'逆时针（上一座）',opposite:'对家'}[r.direction]}。提交前点已选牌可撤销；不是把牌丢进牌河。` : '本场不换牌。',
      r.missing==='declared'?'换牌完成后四人各选定缺一门，全部选择后统一公布；这局不能再改。':'本场自由打缺，跳过声明阶段；胡时仍必须缺至少一门。',
      '轮到自己摸一张再打一张。碰是拿别人打出的牌与自己的两张同牌组成刻子；碰后先打牌。杠后从同一牌墙补一张。响应时胡牌优先于碰杠；等所有合法响应完成后一次裁定。',
      `自摸用自己摸入的牌胡，点炮胡用别人的弃牌。${r.multiWin?'允许一炮多响，赢家按出牌者下家起的座位顺序排列，同一组并列该次胡牌名次。':'关闭多响，只取出牌者下家起最近的合法赢家。'}按钮先后不决定赢家顺序。`,
      '胡者停止摸打碰杠，剩余玩家继续。三家已胡，或墙空且最后响应处理完毕，才结束小局；不会因第一家胡牌就宣布整场结束。',
      `下一局${r.dealerPolicy==='rotate'?'轮庄': '首胡者坐庄；首胡多人同响时由该次出牌者坐庄'}；无首胡的墙尽局${r.drawDealer==='stay'?'连庄':'轮庄'}。${r.bankruptcy?'完整小局清算后如有人负分提前结束比赛。':'允许负积分，完成设定局数才结束比赛。'}`,
    ];
    case 'missing': return [
      `缺一门是胡牌条件：包含副露和胡牌张，不能三门俱全。${r.missing==='declared'?'定缺还要求指定那门完全清掉；手中有缺牌时必须先弃缺牌。':'自由打缺不预选门，也不强制先弃哪门；胡牌时检查缺门。'}`,
      `指定缺门本身永远不能碰杠。${r.missing==='dynamic'?'自由模式没有指定缺门。':r.unclearedCalls?'尚有缺牌时允许碰杠其他门，之后仍必须先打缺。':'尚有缺牌时也不能碰杠其他门。'}`,
      `胡牌需张数、普通或允许的七对结构、缺门和当前响应限制全部满足；不要求额外奖励番型。${r.selfDrawOnly?'本场仅自摸，不能接炮或抢补杠。':'本场允许自摸和点炮胡。'}`,
      `过手胡：${{off:'关闭；放过一次胡不另加此限制。','until-draw':'放弃合法接炮后，本人实际摸牌前不能再接炮。',higher:'放弃合法接炮后，本人摸牌前只可胡基值更高的牌（不是看净收入）。'}[r.passWin]}碰牌不会解除；自摸不受这项接炮限制。`,
      `抢补杠${r.robKong?'开启':'关闭'}：只可抢将已有碰升级的第四张，不能抢暗杠。允许抢与抢杠奖励独立；关闭奖励不会自动关闭合法抢补杠。`,
      '查花猪是墙尽时检查缺门的清算，不是花牌。是否开启查花猪，不会取消胡牌必须缺门的条件。',
    ];
    case 'scoring': return [
      `本场底分${r.base}，${r.cap?`${r.cap}番封顶`:'不封顶'}。原始番数是成立奖励相加；计分番数按封顶截断；胡牌基值＝底分×2的计分番数次方。平胡没有奖励为0番，倍率1，并不是0分。`,
      `普通点炮由放炮者向每位赢家支付该手基值；普通自摸只由当时尚未胡的其他玩家支付。自摸附加：${r.selfDraw==='none'?'不附加':r.selfDraw==='base'?`每位付款者在基值后加${r.selfDrawExtra}个底分`:`加${r.selfDrawExtra}番，${r.extraAfterCap?'先封顶再加番，可超过原封顶':'先加番再封顶'}`}。`,
      '整局净变化要把收到的胡分、以前付出的胡分、杠分及终局清算一起加减。庄家不自动乘额外倍率。',
      '以下固定教学预设独立于当前设置：底分1、三番封顶、自摸加1底；只开启定缺基础预设的默认番型，缺条，无杠/末张等特殊事件。金额不会冒充当前自定义配置。',
      '连续例：A先平胡自摸获6，其他三家各−2；再由B清一色自摸向C/D各收5，A已胡不付。累计净变化A＋6、B＋8、C−7、D−7：先胡不一定赚最多。',
    ];
    case 'settlement': return [
      '暗杠：自己四张相同；直杠：自己三张接别人第四张；补杠：已有碰，再补自己手中的第四张。墙中必须还有补牌才可开杠。被抢的补杠不完成，不收该笔杠分，也不补牌，原碰保留。',
      r.kongPay?`本场杠分开启：直杠${r.directPay==='source'?'放杠者':'其余活跃玩家每家'}支付${r.directRate}底（${r.directRate*r.base}分）；补杠其余活跃者各${r.addedRate}底；暗杠各${r.concealedRate}底。`:'本场关闭杠分：仍可依法开杠，但不产生该笔杠收入。',
      `点杠花包赔${r.directResponsibility?'开启：放杠者承担其他活跃者原本应付的总额，不是固定三倍':'关闭：成功直杠后直接自摸按普通活跃玩家支付'}。`,
      `呼叫转移${r.transfer?'开启：成功杠补牌后直接弃牌放炮，只转移最近那笔杠的实际收入，':''}${!r.transfer?'关闭。':r.transferSplit==='nearest'?'出牌者下家起最近赢家收取。':'多赢家均分，除不尽按座位顺序各补1分。'}它和杠上炮加番分别计算。`,
      '只有墙尽结束执行退税、查花猪、查叫；三家已胡结束不执行这套墙尽检查。先把玩家分为已胡、花猪、听牌、未听；先退税，再按座位逐家结算花猪和查叫。',
      `退税：${{off:'关闭','not-ready':'未胡未听者（含花猪）退还此前所收杠分','all-unwon':'所有未胡者退还此前所收杠分'}[r.refund]}。逐笔退原付款者，原付款者即使已胡也可能收回；已呼叫转移的杠收入不重复退。`,
      `查花猪${r.pig?`开启：每位花猪向每位非花猪支付${r.pigPenalty==='cap'?r.base*2**r.cap:r.base*r.pigRate}分；收款者${r.pigIncludesWon?'包含':'不包含'}已胡玩家。`:'关闭。'}定缺看指定门没清掉；自由打缺看是否三门俱全。`,
      `查叫${r.readyPay?'开启：未胡未听者向未胡且合格听牌者支付对方最高合法胡牌基值；不假设自摸、杠开或海底奖励。':'关闭。'}花猪${r.pigAlsoReady?'也叠加':'不重复支付'}查叫。`,
      `听牌口径：${r.readyPolicy==='structural'?'结构听：存在合法胡牌张即计听，不扣除其他人公开牌已耗尽的情况。':'排除公开耗尽：只看自己的牌和公开牌，若某种四张全可见则不计该待牌；不偷看墙或对手暗牌。'}已胡者退出后续普通支付，不等于所有历史退款或清算分数永久冻结。`,
    ];
    case 'faq': return [
      '为什么不能胡？先核对手牌与副露的张数、四面子一对或开启的七对、缺门；再看仅自摸、过手胡与当前响应。听牌提示只作辅助，最终可执行动作由本场规则判断。',
      '关闭番型还能不能胡？大对子、清一色等关闭通常只是不加奖励，普通结构仍能以0番胡；七对例外：关闭会移除特殊七对结构，只有同时能拆成普通结构才仍能胡。',
      '为什么被扣分？可能是此前放炮/他人自摸、杠分、查花猪、查叫或退税。打开独立“账本”核对付款→收款与原因；教程本身不改变积分。',
      '为什么胡后还在桌上？血战保留四座，已胡者观战，其余人继续。多人同一张牌胡是同一胡牌组，实体牌没有复制，名次也不是按点按钮速度。',
      '为什么关掉规则页没有新一局？阅读只是覆盖原页面。当前设置草稿和本场快照各自独立；局内阅读冻结权威计时，返回保留此前暂停状态和剩余Bank，不重新发牌。',
    ];
  }
}

export function patternAvailability(id: Pattern, c: XzConfig): string {
  if (!c.rules.patterns[id].enabled) return '未启用';
  if (id==='robKong'&&!c.rules.robKong) return '奖励开启，但不允许抢补杠';
  if (['kongDiscard','lastDiscard','earth'].includes(id)&&c.rules.selfDrawOnly) return '奖励开启，但仅自摸时不适用';
  return '已启用';
}
export const patternName = (id: Pattern) => PATTERNS[id][0];

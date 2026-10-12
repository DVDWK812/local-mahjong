import type { TileId } from '../types';
import type { GbGroup } from './types';
import type { GbFanId } from './fanCatalog';
import type { GbScoringInput } from './scoring';
import { parseGbTiles } from './scenarios';
// Hand-authored structural examples from WMO annex 1. No runtime scorer generates tutorial claims.
interface Row{id:GbFanId;hand:string;fixed?:[string,GbGroup['kind'],boolean][];extra?:Partial<GbScoringInput>}
const row=(id:GbFanId,hand:string,fixed?:Row['fixed'],extra?:Row['extra']):Row=>({id,hand,fixed,extra});
const base='123456m 789p CCC 55s';
export const GB_GUIDE_EXAMPLES:Row[]=[
 row('BIG_FOUR_WINDS','EEE SSS WWW NNN 55p'),row('BIG_THREE_DRAGONS','PPP FFF CCC 123m 55p'),
 row('ALL_GREEN','222333444666s FF'),row('NINE_GATES','1112345678999m 5m'),
 row('FOUR_KONGS','55p',[['1111m','kan',true],['2222p','kan',true],['4444p','kan',true],['5555s','kan',true]]),
 row('SEVEN_SHIFTED_PAIRS','11223344556677m'),row('THIRTEEN_ORPHANS','19m 19p 19s ESWNPFC 1m'),
 row('ALL_TERMINALS','111999m 111p 999s 99p'),row('LITTLE_FOUR_WINDS','EEE SSS WWW 123m NN'),
 row('LITTLE_THREE_DRAGONS','PPP FFF 123m 789p CC'),row('ALL_HONORS','EEE SSS PPP FFF CC'),
 row('FOUR_CONCEALED_PUNGS','222m 444p 666s CCC 55p'),
 row('PURE_TERMINAL_CHOWS','123123789789m 55m'),row('QUADRUPLE_CHOW','123123123123m 55p'),
 row('FOUR_PURE_SHIFTED_PUNGS','111222333444m 55p'),row('FOUR_PURE_SHIFTED_CHOWS','123345567789m 55p'),
 row('THREE_KONGS','123s 55p',[['1111m','kan',true],['2222p','kan',true],['4444p','kan',true]]),
 row('ALL_TERMINALS_AND_HONORS','111m 999p EEE CCC NN'),row('SEVEN_PAIRS','11m 33m 55p 77p 99s EE CC'),
 row('GREATER_HONORS_AND_KNITTED_TILES','147m 258p 3s ESWNPFC'),row('ALL_EVEN_PUNGS','222m 444p 666s 888m 22p'),
 row('FULL_FLUSH','123456789m 222m 55m'),row('PURE_TRIPLE_CHOW','123123m 789p 55s',[['123m','chi',true]]),
 row('PURE_SHIFTED_PUNGS','222333444m 678p 55s'),row('UPPER_TILES','777888m 789p 999s 88p'),
 row('MIDDLE_TILES','444555m 456p 666s 55p'),row('LOWER_TILES','111222m 123p 333s 22p'),
 row('PURE_STRAIGHT','123456789m CCC 55p'),row('THREE_SUITED_TERMINAL_CHOWS','123789m 123789p 55s'),
 row('PURE_SHIFTED_CHOWS','123234345m 789p 55s'),row('ALL_FIVES','345m 456p 567s 555m 55p'),
 row('TRIPLE_PUNG','222m 222p 222s 789m 55p'),row('THREE_CONCEALED_PUNGS','222m 444p CCC 78s 55p 9s'),
 row('LESSER_HONORS_AND_KNITTED_TILES','147m 258p 369s ESWNP'),row('KNITTED_STRAIGHT','147m 258p 369s CCC 55p'),
 row('UPPER_FOUR','678m 678p 789s 666p 88m'),row('LOWER_FOUR','123m 234p 234s 444p 22m'),
 row('BIG_THREE_WINDS','EEE SSS WWW 123m 55p'),row('MIXED_STRAIGHT','123m 456p 789s CCC 55p'),
 row('REVERSIBLE_TILES','123p 345p 888s PPP 55s'),row('MIXED_TRIPLE_CHOW','234m 234p 234s CCC 55p'),
 row('MIXED_SHIFTED_PUNGS','222m 333p 444s 789m 55p'),
 row('CHICKEN_HAND','567p 789s 23s NN 4s',[['123m','chi',true]]),
 row('LAST_TILE_DRAW',base,undefined,{selfDraw:true,source:'live',lastWall:true}),
 row('LAST_TILE_CLAIM',base,undefined,{lastWall:true}),row('OUT_WITH_REPLACEMENT_TILE',base,undefined,{selfDraw:true,source:'kong'}),
 row('ROBBING_THE_KONG',base,undefined,{source:'robbed-kong'}),
 row('TWO_CONCEALED_KONGS','123s 678m 55p',[['1111m','kan',false],['2222p','kan',false]]),
 row('ALL_PUNGS','222m 555p 999s 55m',[['111m','pon',true]]),
 row('HALF_FLUSH','123456789m EEE 55m'),row('MIXED_SHIFTED_CHOWS','123m 234p 345s CCC 55p'),
 row('ALL_TYPES','123m 456p 789s EEE CC'),row('MELDED_HAND','55p',[['123m','chi',true],['456m','chi',true],['789s','chi',true],['CCC','pon',true]]),
 row('TWO_DRAGON_PUNGS','PPP CCC 123m 456p 55s'),row('OUTSIDE_HAND','123m 789p 111s CCC EE'),
 row('FULLY_CONCEALED_HAND',base,undefined,{selfDraw:true,source:'live'}),
 row('TWO_MELDED_KONGS','123s 678m 55p',[['1111m','kan',true],['2222p','kan',true]]),
 row('LAST_TILE',base,undefined,{visibleOtherCopies:3}),row('DRAGON_PUNG',base),
 row('PREVALENT_WIND','123456m 789p EEE 55s'),row('SEAT_WIND','123456m 789p SSS 55s'),
 row('CONCEALED_HAND',base),row('ALL_CHOWS','234m 456p 678s 123p 55m'),
 row('TILE_HOG','123m 111m 456p 789s EE'),row('DOUBLE_PUNG','222m 222p 456s CCC 55p'),
 row('TWO_CONCEALED_PUNGS','222m CCC 12p 55s 3p',[['789s','chi',true]]),
 row('CONCEALED_KONG','123s 678m CCC 55p',[['1111m','kan',false]]),
 row('ALL_SIMPLES','234m 456p 678s 222p 55m'),
 row('PURE_DOUBLE_CHOW','123123m 456p CCC 55s'),row('MIXED_DOUBLE_CHOW','123m 123p 456s CCC 55p'),
 row('SHORT_STRAIGHT','123456m 789p CCC 55s'),row('TWO_TERMINAL_CHOWS','123789m 456p CCC 55s'),
 row('PUNG_OF_TERMINALS_OR_HONORS','111m 234p 567s CCC 55p'),
 row('MELDED_KONG','123s 678m CCC 55p',[['1111m','kan',true]]),
 row('ONE_VOIDED_SUIT','123456m 789p CCC 55p'),row('NO_HONORS','123456m 789p 222s 55p'),
 row('EDGE_WAIT','123456m CCC 55p 12s 3s'),row('CLOSED_WAIT','123456m CCC 55p 46s 5s'),
 row('SINGLE_WAIT',base),row('SELF_DRAWN','456p 234s 789s 66m',[['123m','chi',true]],{selfDraw:true,source:'live'}),
 row('FLOWER_TILES',base,undefined,{flowers:8}),
];
export function guideInput(r:Row){const ids=parseGbTiles(r.hand),winningTile=ids.pop()!;return {concealed:ids,winningTile,melds:(r.fixed??[]).map(([t,kind,opened])=>({ids:parseGbTiles(t),kind,opened,fixed:true})),selfDraw:false,source:'discard',flowers:0,seatWind:1,roundWind:0,lastWall:false,visibleOtherCopies:0,...r.extra} as GbScoringInput;}

export const GB_GUIDE_SECTIONS: { id: string; title: string; paragraphs: string[]; tiles?: TileId[] }[] = [
 {id:'flow',title:'从零开始的一盘',paragraphs:[
  '目标：把自己的牌组成认可的和牌形，并获得至少8番非花番值。牌形成立只是第一步，不等于一定可以和。四个人依次行动，每盘先由庄家开始。',
  '①发牌：四人各13张常规牌，庄家14张；花牌会自动公开并从牌尾补到常规牌。②庄家打出1张。③其他人可和、碰、杠，上家的下家还可吃；不操作选过。④无人取牌时，下家从牌墙头摸1张，再打1张。',
  '⑤反复摸打，把散牌整理成面子和将。听牌是再来某张即可形成和形；查看提示中的点和与自摸番值。⑥有人合法和牌时结算；牌墙用尽无人和牌则流局。结果点下一盘继续。单盘练习只打一盘，完整局依次打16盘。',
  '第一次练习建议开启资格提示：先识别对子和顺子，试着做“花龙”或“三色三同顺”等8番路线；吃碰会改变门清番，不要见到能吃碰就一定操作。所有候选由规则计算，按钮缺席表示当前没有该合法动作。']},
 {id:'tiles',title:'认识牌和桌面',tiles:parseGbTiles('123m 123p 123s ESWNPFC'),paragraphs:[
  '万、筒、条各有1至9，每种4张，共108张。东、南、西、北为风牌，白、发、中为箭牌，七种字牌各4张，共28张。字牌没有顺序，不能组成顺子。数牌1和9叫幺九，字牌也属于幺九字牌。',
  '春、夏、秋、冬、梅、兰、竹、菊是8张各一张的花牌，总牌数144。花牌在自己的公开花牌区，不进和牌结构，也不作吃碰杠面子。',
  '下方是自己的暗手，带间隔的新牌是摸牌；每人面前的牌河记录弃牌，副露区放吃碰杠，花牌区单独显示归属。对手暗手和暗杠内容保密。中央显示圈风、盘次、剩余牌和积分，头像对应固定玩家身份。',
  '桌面方位与门风不是角色身份：每盘轮庄、圈间换位会改变门风和桌面席位；玩家姓名、累计积分、电脑风格与声音仍跟随本人。']},
 {id:'shapes',title:'面子、将与和牌形',tiles:parseGbTiles('123m 555p 7777s EE'),paragraphs:[
  '局部示意（不是完整和牌）：123万为顺子，同花色连续三张；555筒为刻子，三张相同；7777条为杠，四张相同；东东为将，一对相同。常规和形为4个面子＋1对将。杠算一个面子，第四张是实际存在的额外牌，开杠后补1张，不能按14张物理总数一概否定。',
  '七对：7个对子，国标允许4张同牌作为2对；连七对是同花色7个连续点数的对子。十三幺：三色1、9和七种字牌各1张，再有其中1张作对。这些特殊结构不按4面子＋将拆。',
  '全不靠：从三种花色分别配给147、258、369的数牌与字牌中取14张互不重复的牌；七星不靠还须七种字牌齐全。组合龙：三个不同花色分别组成147、258、369的9张，再有一个面子和将。花色分配可以互换。',
  '一手牌可能有多种拆法和和牌张归属。系统比较合法计分解释，再按包含、不重复与组合复用约束选择最高结果；不能只取第一种拆法。']},
 {id:'actions',title:'摸打、吃碰杠和与过',paragraphs:[
  '摸打：轮到自己从牌墙头摸1张，再弃1张进入牌河。点和是借他人的公开弃牌完成和牌；自摸是自己从牌墙摸到和牌张。两者的条件番和支付不同。过表示放弃本次响应；本模式不沿用振听限制。',
  '吃只允许吃上家的弃牌，使用自己两张牌组成顺子；有多种吃法时选择完整候选。碰可取任意他人的弃牌，和自己两张相同牌组成刻子。吃碰后不再摸牌，必须先打一张，下一次摸牌前不能自开杠；允许跟张打牌。',
  '明杠：取他人弃牌和自己三张相同牌组成杠。暗杠：自己手中四张相同牌，内容不向对手公开。加杠：把已碰出的刻子补成杠，先等待其他人的抢杠响应，无人和才提交并补牌；抢杠成功不升级原碰、不补牌。暗杠不能抢。',
  '响应优先级：和＞碰或杠＞吃。收齐所有必要响应再执行；多人请求和牌时，仅裁定弃牌者下家起最近的一位，点击快慢不决定赢家。抢加杠也遵循同一裁定。',
  '每种操作都要符合当前牌形、真实牌和八番资格。未提交的候选、hover与点击尝试不是公开事件，也不会触发报牌。最后弃牌后墙为0时只可和或过，不再吃碰杠。']},
 {id:'flowers',title:'花牌、连续补花与牌尾',paragraphs:[
  '本数字版自动公开花牌，不把花留在暗手、不允许弃花。开局按庄、南、西、北依次把每家的花补完；补到花继续公开并从牌尾取牌，直到常规牌或墙尽。普通摸牌取墙头，补花和杠补牌取墙尾，没有日麻固定王牌或四次岭上限制。',
  '花牌每张1分，只在非花已到8番、合法和牌后加入结算。非花7＋花1仍不够门槛；8＋花1才结算9番。',
  '杠后从牌尾直接补到常规和牌张才按本冻结合同计杠上开花。杠补到花、再补到和牌张，实际来源为补花，不计杠上开花；普通补花自摸也不能算此项。',
  '每取一张都真实扣减墙剩余。仅剩花而无常规牌可补时，公开已取到的花、零支付流局，不制造一张虚拟摸牌。妙手回春、海底捞月等条件依据实际末张事件，花不是可弃牌。']},
 {id:'fansIntro',title:'番值、八番与常见路线',paragraphs:[
  '番种描述特定结构或事件；番值是它的分值。有的可计多次，有的包含低番不得重复。先确认牌形与实例合法，再把允许组合的非花番相加；至少8番才能和，最后才加入花牌分。',
  '常见入门：花龙8番＝三色分别123、456、789；三色三同顺8番＝三色同首数的顺子。碰碰和6番＝4刻/杠＋将；混一色6番＝一种数牌花色＋字牌；这两个各自不足8，需合法附加项。清一色24番不含字，七对24番是7对。',
  '箭刻2番：中、发、白的刻/杠；圈风刻2与门风刻2分别对照当前圈风、本人门风；门清点和2、不求人自摸4不同。断幺2番、平和2番等低番能否组合看完整手形，不能只数名称。',
  '无番和8番：已成和型，但不存在任何其他非花番。不是把1到7番凑成8；若自摸带来自摸等番，便不能把无番和当补分。',
  '条件番只在真实事件发生时成立：抢加杠、末张、自摸与和绝张。提示分别展示点和/自摸资格；关闭提示不改变和牌判定。完整81项和固定算例可从目录查看。']},
 {id:'combination',title:'组合计分与不计原则',paragraphs:[
  '不重复：番种必然包含的低番不再计。例如清一色不计无字；一色双龙会不计平和、一般高、老少副、无字及清一色；全求人不计单调将。大三元不再逐个加箭刻。',
  '不得相同/套算：同组牌不能反复充当同一番的计分依据。组合已用的牌组只有按冻结组合原则与新的牌组再形成允许项；不能把所有两两配对全部相加。顺刻高番、包含和参与组同时审核。',
  '不拆移：已经选定的一种拆解不能为了另一个番临时改组后与原解释并加。多拆解竞争时分别算完整合法解释，再选最高。结果中的拆解、参与组和排除明细可查看依据。',
  '暗刻：不是所有未副露刻子都按暗刻计。点和张补成的刻子为明刻；自摸补成则可按暗刻。暗杠是4张，单独不计四归一；两暗杠冻结为8番。一明一暗合计6，三/四杠按高番与允许暗属性处理，不叠所有杠组合。']},
 {id:'payment',title:'支付、轮庄换圈与结束',paragraphs:[
  '合法和牌后设F为非花番＋花分。点和：放铳者付F＋8，另两家各付8，赢家总收入F＋24。自摸：三家各付F＋8，赢家总收入3×（F＋8）。积分可以为负，每盘净变化总和0。番值不是赢家收入；花牌、底分和账本分开显示。',
  '流局无人支付，不按听牌罚分。每盘轮庄，不连庄、不加本场、不加立直供托，也没有独立杠分。完整局东南西北各4盘，共16盘；单盘练习完成一盘即结束。',
  '圈间按WMO附件四换位，身份编号的席位排列依次为[0,1,2,3]、[1,0,3,2]、[2,3,1,0]、[3,2,0,1]。姓名、累计积分、控制权、风格与声音跟随身份；花牌属于本盘本人。',
  '每人初始0分，按累计净变化排名；同分按初始参与者顺序。显示的本地净积分不是赛事标准分。既无击飞终局也无日麻目标点数。']},
 {id:'operations',title:'计时、和鸣切、保存与问答',paragraphs:[
  '时间控制由Match权威计时，包含每次基础时间与可用Bank；不是动画或UI的倒计时决定超时。出牌超时优先摸切可合法打出的摸牌；吃碰后没有摸牌时作确定性合法弃牌；响应超时自动过。补花不是真人决策，不刷新或赠送额度。',
  '“和”开启自动和，仅在真实可和时生效；“鸣”表示不吃碰杠，不阻止补花或正常和；“切”自动摸切。多个开关同时开启时先处理必要补花和合法自动和，再考虑弃牌。',
  '保存记录本局配置、花牌、墙位置、身份、积分账本、决策与剩余时间。恢复不再次补牌、不重复支付、不发新Bank。响应中可保存恢复；回放可顺序播放与跳转，只重建记录，不改变实时比赛、不重播历史语音。未知版本拒绝，旧其他模式记录不修改。',
  '问：有14张为什么不能和？答：先看是否有合法和形，再看非花至少8番。问：有花可以少一番吗？答：不可以。问：同牌有点和/自摸两个数为什么？答：门清、自摸等条件不同。问：没声音是否没报牌文件？答：先检查静音、语音和报牌开关、音量及每位玩家包；管理页所选包不是比赛角色配置。',
  '阅读本页会由本地权威暂停保护行牌、AI和真人计时；关闭保持同一个决策及剩余时间，原有暂停仍保留。这是本地操作政策，不是线下竞赛暂停条款。按返回或Escape关闭，回到原来的设置或牌桌。']},
];

export const GB_GUIDE_EXCLUSIONS: Partial<Record<GbFanId,string>> = {
 ALL_TYPES:'万、筒、条、风牌、箭牌五类都必须出现；特殊不靠、十三幺等必含五门时不重复计。',
 MIXED_SHIFTED_CHOWS:'三种花色顺子的首数逐次差1；同组不重复套算其他组合。', OUTSIDE_HAND:'每个面子与将均含1、9或字；与清幺九、混幺九、字一色等必含结构不重复。',
 BIG_FOUR_WINDS:'不计碰碰和、三风刻、幺九刻、圈风刻与门风刻。', BIG_THREE_DRAGONS:'不计双箭刻与箭刻；箭刻不再当幺九刻。', ALL_GREEN:'其他合法项仍须分别审核；若与七对同计，不重复其必含的四归一。', NINE_GATES:'必须门清，不计清一色、门前清及必含的幺九刻；和入牌可能带来独立刻组。', FOUR_KONGS:'不计碰碰和、单调将；杠次数不重复低阶组合，暗属性按完整条件处理。', SEVEN_SHIFTED_PAIRS:'不计七对、清一色、门前清、单调将。', THIRTEEN_ORPHANS:'不计五门齐、门前清、单调将。', ALL_TERMINALS:'不计碰碰和、全带幺、幺九刻、无字。', LITTLE_FOUR_WINDS:'不计三风刻和对应幺九刻；门风圈风按实际另审核。', LITTLE_THREE_DRAGONS:'不计双箭刻；对应箭刻不再重复。', ALL_HONORS:'不计碰碰和、混幺九、全带幺、幺九刻。', FOUR_CONCEALED_PUNGS:'不计碰碰和、门前清、三暗刻、双暗刻；点和只能成将才能保留四暗刻。', PURE_TERMINAL_CHOWS:'不计清一色、平和、一般高、老少副、无字。', QUADRUPLE_CHOW:'不计一色三同顺、一般高与四归一。', FOUR_PURE_SHIFTED_PUNGS:'不计一色三节高和碰碰和。', FOUR_PURE_SHIFTED_CHOWS:'不计一色三步高；不可同时以同组套算连六。', THREE_KONGS:'不重复明杠/双明杠组合；只加允许的暗属性番。', ALL_TERMINALS_AND_HONORS:'不计碰碰和、全带幺、幺九刻。', SEVEN_PAIRS:'不计门前清、单调将；四张同牌可作两对并按条件计四归一。', GREATER_HONORS_AND_KNITTED_TILES:'不计全不靠、五门齐、门前清。', ALL_EVEN_PUNGS:'不计碰碰和、断幺、无字。', FULL_FLUSH:'不计缺一门、无字。', PURE_TRIPLE_CHOW:'不计一般高，也不与同组一色三节高并计。', PURE_SHIFTED_PUNGS:'不与同组一色三同顺并计。', UPPER_TILES:'不计大于五、无字。', MIDDLE_TILES:'不计断幺、无字。', LOWER_TILES:'不计小于五、无字。', PURE_STRAIGHT:'不得用同三组拆算连六、老少副。', THREE_SUITED_TERMINAL_CHOWS:'不计平和、喜相逢、老少副、无字。', PURE_SHIFTED_CHOWS:'步长须始终1或始终2；参与组不得套算同一番。', ALL_FIVES:'不计断幺；每面子及将都必须含5。', TRIPLE_PUNG:'不计同组双同刻。', THREE_CONCEALED_PUNGS:'不计双暗刻；点和成刻不算暗刻。', LESSER_HONORS_AND_KNITTED_TILES:'不计五门齐、门前清；满9数牌时可按规则另计组合龙。', KNITTED_STRAIGHT:'9张组合牌不拆成普通顺子计连六/喜相逢；其余面子及将另审核。', UPPER_FOUR:'不计无字。', LOWER_FOUR:'不计无字。', BIG_THREE_WINDS:'不再逐个计对应幺九刻；门风圈风按实际审核。', MIXED_STRAIGHT:'三色分别首段、中段、尾段；不能把跨花色数列当清龙。', REVERSIBLE_TILES:'不计缺一门；万、风、中、发不符合牌面范围。', MIXED_TRIPLE_CHOW:'不计同组喜相逢。', MIXED_SHIFTED_PUNGS:'同一组参与牌不能反复套算。', CHICKEN_HAND:'只有没有任何其他非花番才成立；1至7番不能补成无番和，自摸等番也会使其不成立。', LAST_TILE_DRAW:'不再另计自摸；必须实际从墙摸到最后常规牌和。', LAST_TILE_CLAIM:'必须实际最后弃牌，不靠视觉判断。', OUT_WITH_REPLACEMENT_TILE:'不另计自摸；普通补花或杠后遇花再补不能计本项。', ROBBING_THE_KONG:'只抢加杠；不计和绝张，暗杠不可抢。', TWO_CONCEALED_KONGS:'冻结值8，不计暗杠与双暗刻；高阶杠组合不叠低阶次数。', ALL_PUNGS:'四刻/杠不必全暗；被更高必含结构排除时不另计。', HALF_FLUSH:'须有字牌；全无字为清一色而非混一色。', MELDED_HAND:'四面子明露、点和将；不计单调将，自摸不成立。', TWO_DRAGON_PUNGS:'不计对应箭刻；大三元/小三元包含时不重复。', FULLY_CONCEALED_HAND:'不计门前清、自摸；允许暗杠。', TWO_MELDED_KONGS:'两明杠4番；一明一暗冻结合计6番，不能再叠两个明杠1番。', LAST_TILE:'公开其余三张；抢杠和不重复此项，不能读取隐藏墙。', DRAGON_PUNG:'对应中发白刻子不再计幺九刻。', PREVALENT_WIND:'对应风刻不再重复幺九刻；与门风相同可各计2番。', SEAT_WIND:'对应风刻不再重复幺九刻；门风不是固定玩家座号。', CONCEALED_HAND:'仅门清点和2番，自摸改按不求人；暗杠不破门清。', ALL_CHOWS:'四顺子、数牌将；不计无字。', TILE_HOG:'杠的第四张不能计四归一；一色四同顺包含时不计。', DOUBLE_PUNG:'三同刻已使用组不重复双同刻。', TWO_CONCEALED_PUNGS:'点和补成的刻子不算暗刻；双暗杠包含时不重复。', CONCEALED_KONG:'4相同牌未公开；不计同杠四归一，次数受高阶杠约束。', ALL_SIMPLES:'不计无字。', PURE_DOUBLE_CHOW:'同组已用于一色三/四同顺不能再算；两独立组对可分别审核。', MIXED_DOUBLE_CHOW:'同组三色三同顺已经包含则不重复。', SHORT_STRAIGHT:'同花色首数差3；清龙包含的两段不得套算。', TWO_TERMINAL_CHOWS:'同花色123与789；清龙/双龙包含的组不重复。', PUNG_OF_TERMINALS_OR_HONORS:'只算1/9及非门风圈风的风刻；箭刻不算，高番排除保留未参与的独立刻。', MELDED_KONG:'高阶杠组合不再叠本项；杠本身没有独立支付。', ONE_VOIDED_SUIT:'只缺少一种数牌花色；清一色/混一色/推不倒等包含时不重复。', NO_HONORS:'只表示无字牌；被清一色、平和、断幺等包含时不重复。', EDGE_WAIT:'仅等3成123或7成789；全手只有这一种牌等待才计。', CLOSED_WAIT:'仅等顺子中间一张；与边张/单调将按选中解释裁定。', SINGLE_WAIT:'只有将牌单一等待；全求人、七对等包含时不计。', SELF_DRAWN:'自己摸入和牌张；不求人、杠上开花、妙手回春等包含时不重复。', FLOWER_TILES:'每张1分，公开花牌不属于和形；非花不足8时不能计入资格或支付。'
};
const fixed=(text:string,kind:GbGroup['kind']='chi',opened=true):GbGroup=>({ids:parseGbTiles(text),kind,opened,fixed:true});
const example=(before:string,win:string,melds:GbGroup[]=[],extras:Partial<GbScoringInput>={}):GbScoringInput=>({concealed:parseGbTiles(before),winningTile:parseGbTiles(win)[0],melds,selfDraw:false,source:'discard',seatWind:1,roundWind:0,flowers:1,lastWall:false,visibleOtherCopies:0,...extras});
export const GB_GUIDE_CASES = [
 {id:'seven',title:'同一牌形：点和7＋1花不能和',input:example('34m 678m WWW 55m','2m',[fixed('789m')]),expected:{nonFlower:7,total:7,canHu:false},context:'南家、东圈；明吃789万，其余暗手；点和2万；1花；无末张/绝张/抢杠事件。',derivation:'混一色6＋幺九刻（西刻不是门风圈风）1＝7。花不补门槛，且已有番，不能改成无番和。'},
 {id:'eight',title:'改为普通自摸：8番后追加花分',input:example('34m 678m WWW 55m','2m',[fixed('789m')],{selfDraw:true,source:'live'}),expected:{nonFlower:8,total:9,canHu:true},context:'南家、东圈；同一明吃789万；自己从墙头摸2万；1花；非末张、非绝张。',derivation:'混一色6＋幺九刻1＋自摸1＝8；再加1花＝9。明吃已破门清，不能算不求人。'},
 {id:'chicken',title:'无番和成立；改自摸反而不是无番和',input:example('567p 789s 23s NN','4s',[fixed('123m')],{flowers:0}),expected:{nonFlower:8,total:8,canHu:true},context:'南家、东圈；明吃123万；点和4条；无花、末张、绝张或抢杠。',derivation:'四顺子＋北将，北是字牌将所以不是平和；三色齐、不门清、无单一等待或其他非花番，才成立无番和8。改普通自摸增加自摸1后，不再能按无番和补8。'},
 {id:'orphans',title:'十三幺自摸与花分',input:example('19m 19p 19s ESWNPFC','1m',[],{selfDraw:true,source:'live',flowers:2}),expected:{nonFlower:92,total:94,canHu:true},context:'南家、东圈；无副露；普通自摸1万；2花；非末张、非绝张。',derivation:'十三幺88＋不求人4＝92；不重复门前清、单调将、自摸；加2花＝94。'},
 {id:'exclusion',title:'一色双龙会：目标番与合计不同',input:example('5m','5m',[fixed('123m'),fixed('789m'),fixed('123m'),fixed('789m')],{flowers:0}),expected:{nonFlower:70,total:70,canHu:true},context:'南家、东圈；四组明吃；点和5万；0花；非末张、非绝张。',derivation:'一色双龙会64＋全求人6＝70。不再加清一色、平和、一般高、老少副、无字或单调将。'}
];

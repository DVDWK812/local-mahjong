import * as HandUtil from './hand-util';
import { hasJanpai } from './jan-util';
import { McrComplete } from './mcr-complete';
import { MCR_YAKU } from './mcr-yaku';
import { sortMentsuList, toJanpaiList } from './mentsu-util';
import * as YakuUtil from './yaku-util';
import { ZJM_YAKU } from './zjm-yaku';
export default class McrUtil {
    static complete(hand, completeInfo) {
        const yakuList = [];
        const janpaiList = HandUtil.janpaiListWith(hand, completeInfo.janpai);
        if (YakuUtil.honorsAndKnittedTiles(janpaiList)) {
            yakuList.push(...this._brokenYakuList(janpaiList));
            yakuList.push(...this._beingWholeYakuList(hand, completeInfo));
            return new McrComplete(this._removeExcludeYaku(yakuList, completeInfo));
        }
        if (YakuUtil.thirteenOrphans(janpaiList)) {
            yakuList.push(MCR_YAKU.THIRTEEN_ORPHANS);
            yakuList.push(...this._beingWholeYakuList(hand, completeInfo));
            return new McrComplete(this._removeExcludeYaku(yakuList, completeInfo));
        }
        yakuList.push(...this._mentsuYakuList(hand, completeInfo));
        const allJanpaiList = HandUtil.allJanpaiListWith(hand, completeInfo.janpai);
        // 七対と複合できるよう、字一色は_honorTilesYakuList()でなくここで判定
        if (YakuUtil.allHonors(allJanpaiList)) {
            yakuList.push(MCR_YAKU.ALL_HONORS);
        }
        // 七対と複合できるよう、幺九類は幺九刻を除きここで判定
        this._push(yakuList, this._terminalsOrHonorsYaku(allJanpaiList));
        yakuList.push(...this._fullChowsYakuList(hand, completeInfo.janpai));
        yakuList.push(...this._limitedNumberYakuList(allJanpaiList));
        yakuList.push(...this._beingWholeYakuList(hand, completeInfo));
        this._specialYakuList(yakuList, hand, completeInfo.janpai);
        return new McrComplete(this._removeExcludeYaku(yakuList, completeInfo));
    }
    static _allChows(completePattern) {
        const length = completePattern.chowList.length + completePattern.knittedChowList.length;
        return length === 4 && !completePattern.head.ji;
    }
    static _allInvolvedYaku(completePattern) {
        switch (YakuUtil.terminalsYaku(completePattern)) {
            case ZJM_YAKU.PURE_LESSER_TERMINALS:
            case ZJM_YAKU.MIXED_LESSER_TERMINALS:
                return MCR_YAKU.OUTSIDE_HAND;
        }
        // 全大、全中、全小、大于五、小于五、断幺は_limitedNumberYakuList()で判定
        return YakuUtil.allFives(completePattern) ? MCR_YAKU.ALL_FIVES : undefined;
    }
    static _allEvenPungs(completePattern) {
        return completePattern.head.even &&
            toJanpaiList(completePattern.mentsuList).every((j) => { return j.even; });
    }
    static _beingWholeYakuList(hand, completeInfo) {
        const yakuList = YakuUtil.incidentalBonusesYakuList(completeInfo).map((y) => {
            switch (y) {
                case ZJM_YAKU.FINAL_DRAW:
                    return MCR_YAKU.LAST_TILE_DRAW;
                case ZJM_YAKU.FINAL_DISCARD:
                    return MCR_YAKU.LAST_TILE_CLAIM;
                case ZJM_YAKU.WIN_ON_KONG:
                    return MCR_YAKU.OUT_WITH_REPLACEMENT_TILE;
                case ZJM_YAKU.ROBBING_A_KONG:
                    return MCR_YAKU.ROBBING_THE_KONG;
                default:
                    // 到達不能コードだが、戻り値の型にundefinedが含まれないよう記載
                    throw new Error('Unexpected value');
            }
        });
        if (YakuUtil.meldedHand(hand, completeInfo)) {
            yakuList.push(MCR_YAKU.MELDED_HAND);
        }
        else if (YakuUtil.fullyConcealed(hand, completeInfo)) {
            yakuList.push(MCR_YAKU.FULLY_CONCEALED_HAND);
        }
        else if (YakuUtil.concealedHand(hand, completeInfo)) {
            yakuList.push(MCR_YAKU.CONCEALED_HAND);
        }
        else if (YakuUtil.selfDrawn(hand, completeInfo)) {
            yakuList.push(MCR_YAKU.SELF_DRAWN);
        }
        if (YakuUtil.lastTile(completeInfo)) {
            yakuList.push(MCR_YAKU.LAST_TILE);
        }
        // 待ち類は_mentsuYakuList()で判定
        return yakuList;
    }
    static _brokenYakuList(janpaiList) {
        if (YakuUtil.greaterHonorsAndKnittedTiles(janpaiList)) {
            return [MCR_YAKU.GREATER_HONORS_AND_KNITTED_TILES];
        }
        const yakuList = [MCR_YAKU.LESSER_HONORS_AND_KNITTED_TILES];
        if (YakuUtil.knittedStraight(janpaiList)) {
            yakuList.push(MCR_YAKU.KNITTED_STRAIGHT);
        }
        return yakuList;
    }
    static _concealedPungsAndKongsYakuList(completePattern) {
        const yakuList = [];
        this._push(yakuList, this._concealedPungsYaku(completePattern));
        yakuList.push(...this._kongsYakuList(completePattern));
        if (yakuList.includes(MCR_YAKU.TWO_CONCEALED_KONGS)) {
            return yakuList.filter((y) => { return y !== MCR_YAKU.TWO_CONCEALED_PUNGS; });
        }
        return yakuList;
    }
    static _concealedPungsYaku(completePattern) {
        switch (completePattern.concealedPungCount) {
            case 4:
                return MCR_YAKU.FOUR_CONCEALED_PUNGS;
            case 3:
                return MCR_YAKU.THREE_CONCEALED_PUNGS;
            case 2:
                return MCR_YAKU.TWO_CONCEALED_PUNGS;
        }
        return undefined;
    }
    static _dragonsYaku(completePattern) {
        switch (completePattern.dragonCount) {
            case 3:
                return MCR_YAKU.BIG_THREE_DRAGONS;
            case 2:
                if (completePattern.head.dragon) {
                    return MCR_YAKU.LITTLE_THREE_DRAGONS;
                }
                else {
                    return MCR_YAKU.TWO_DRAGON_PUNGS;
                }
            case 1:
                return MCR_YAKU.DRAGON_PUNG;
        }
        return undefined;
    }
    static _fullChowsYakuList(hand, janpai) {
        if (YakuUtil.nineGates(hand.janpaiList)) {
            return [MCR_YAKU.NINE_GATES];
        }
        const yakuList = [];
        const allJanpaiList = HandUtil.allJanpaiListWith(hand, janpai);
        if (YakuUtil.allGreen(allJanpaiList)) {
            yakuList.push(MCR_YAKU.ALL_GREEN);
        }
        if (YakuUtil.fullFlush(allJanpaiList)) {
            yakuList.push(MCR_YAKU.FULL_FLUSH);
        }
        else if (YakuUtil.halfFlush(allJanpaiList)) {
            yakuList.push(MCR_YAKU.HALF_FLUSH);
        }
        else if (YakuUtil.allTypes(allJanpaiList)) {
            yakuList.push(MCR_YAKU.ALL_TYPES);
        }
        else if (YakuUtil.oneVoidedSuit(allJanpaiList)) {
            yakuList.push(MCR_YAKU.ONE_VOIDED_SUIT);
        }
        if (YakuUtil.noHonors(allJanpaiList)) {
            yakuList.push(MCR_YAKU.NO_HONORS);
        }
        return yakuList;
    }
    static _higherYakuList(yakuList, newYakuList) {
        const complete = new McrComplete(yakuList);
        const newComplete = new McrComplete(newYakuList);
        return complete.point > newComplete.point ? yakuList : newYakuList;
    }
    static _honorTilesYakuList(completePattern, completeInfo) {
        const yakuList = [];
        // 字一色はyakuList()で判定
        yakuList.push(...this._windsYakuList(completePattern, completeInfo));
        this._push(yakuList, this._dragonsYaku(completePattern));
        return yakuList;
    }
    static _kongsYakuList(completePattern) {
        switch (completePattern.kongCount) {
            case 4:
                if (completePattern.darkKongCount === 1) {
                    return [MCR_YAKU.FOUR_KONGS, MCR_YAKU.CONCEALED_KONG];
                }
                return [MCR_YAKU.FOUR_KONGS];
            case 3:
                return [MCR_YAKU.THREE_KONGS];
            case 2:
                switch (completePattern.darkKongCount) {
                    case 2:
                        return [MCR_YAKU.TWO_CONCEALED_KONGS];
                    case 1:
                        return [MCR_YAKU.TWO_MELDED_KONGS, MCR_YAKU.CONCEALED_KONG];
                    case 0:
                        return [MCR_YAKU.TWO_MELDED_KONGS];
                }
            case 1:
                if (completePattern.darkKongCount === 1) {
                    return [MCR_YAKU.CONCEALED_KONG];
                }
                else {
                    return [MCR_YAKU.MELDED_KONG];
                }
        }
        return [];
    }
    static _limitedNumberYakuList(janpaiList) {
        const yakuList = [];
        if (YakuUtil.upperTiles(janpaiList)) {
            yakuList.push(MCR_YAKU.UPPER_TILES);
        }
        else if (YakuUtil.middleTiles(janpaiList)) {
            yakuList.push(MCR_YAKU.MIDDLE_TILES);
        }
        else if (YakuUtil.lowerTiles(janpaiList)) {
            yakuList.push(MCR_YAKU.LOWER_TILES);
        }
        else if (YakuUtil.upperFour(janpaiList)) {
            yakuList.push(MCR_YAKU.UPPER_FOUR);
        }
        else if (YakuUtil.lowerFour(janpaiList)) {
            yakuList.push(MCR_YAKU.LOWER_FOUR);
        }
        if (YakuUtil.allSimples(janpaiList)) {
            yakuList.push(MCR_YAKU.ALL_SIMPLES);
        }
        return yakuList;
    }
    static _mentsuYakuList(hand, completeInfo) {
        const janpaiList = HandUtil.janpaiListWith(hand, completeInfo.janpai);
        let yakuList = YakuUtil.sevenPairs(janpaiList) ? [this._sevenPairsYaku(janpaiList)] :
            [];
        HandUtil.completePatternList(hand, completeInfo).forEach((c) => {
            const newYakuList = [];
            newYakuList.push(...this._honorTilesYakuList(c, completeInfo));
            newYakuList.push(...this._numberTilesYakuList(c));
            newYakuList.push(...this._pungsYakuList(c));
            // _allInvolvedYaku(), _waitYaku()は面子が必要なため、ここで判定
            this._push(newYakuList, this._allInvolvedYaku(c));
            this._push(newYakuList, this._waitYaku(c, completeInfo.janpai, hand.completableList));
            // removeExcludeYaku()ではcompletePattenがわからないため、ここで判定
            this._removeWaitYaku(newYakuList, c.knittedChowList, completeInfo.janpai);
            yakuList = this._higherYakuList(yakuList, newYakuList);
        });
        return yakuList;
    }
    static _numberTilesYakuList(completePattern) {
        const yakuList = [];
        if (this._allChows(completePattern)) {
            yakuList.push(MCR_YAKU.ALL_CHOWS);
        }
        if (completePattern.knittedChowList.length === 3) {
            yakuList.push(MCR_YAKU.KNITTED_STRAIGHT);
        }
        else {
            const chowList = completePattern.chowList;
            switch (chowList.length) {
                case 2:
                    this._push(yakuList, this._twoChowsYaku(chowList));
                    break;
                case 3:
                    yakuList.push(...this._yakuListWithThreeChows(chowList));
                    break;
                case 4:
                    const head = completePattern.head;
                    yakuList.push(...this._yakuListWithFourChows(chowList, head));
                    break;
            }
        }
        return yakuList;
    }
    static _pungsOfTerminalsOrHonors(completePattern) {
        return completePattern.pungList.filter((p) => {
            return p.hasYao;
        }).map((_) => { return MCR_YAKU.PUNG_OF_TERMINALS_OR_HONORS; });
    }
    static _pungsYakuList(completePattern) {
        const yakuList = [];
        const pungList = completePattern.pungList;
        switch (pungList.length) {
            case 2:
                this._push(yakuList, this._twoPungsYaku(pungList));
                break;
            case 3:
                yakuList.push(...this._yakuListWithThreePungs(pungList));
                break;
            case 4:
                if (this._allEvenPungs(completePattern)) {
                    yakuList.push(MCR_YAKU.ALL_EVEN_PUNGS);
                }
                else {
                    yakuList.push(MCR_YAKU.ALL_PUNGS);
                }
                yakuList.push(...this._yakuListWithFourPungs(pungList));
                break;
        }
        yakuList.push(...this._pungsOfTerminalsOrHonors(completePattern));
        yakuList.push(...this._concealedPungsAndKongsYakuList(completePattern));
        return yakuList;
    }
    static _pureTerminalChows(fourChows, head) {
        const yakuList = this._twoMentsuYakuList(fourChows, 4);
        const expectedYakuList = [MCR_YAKU.PURE_DOUBLE_CHOW, MCR_YAKU.TWO_TERMINAL_CHOWS,
            MCR_YAKU.TWO_TERMINAL_CHOWS, MCR_YAKU.PURE_DOUBLE_CHOW];
        return expectedYakuList.every((y, i) => { return y === yakuList[i]; }) &&
            head.five && fourChows[0].suit === head.suit;
    }
    static _push(yakuList, yaku) {
        if (yaku) {
            yakuList.push(yaku);
        }
    }
    static _removeExcludeYaku(yakuList, completeInfo) {
        let excludedYakuList = [...yakuList];
        yakuList.forEach((yaku) => {
            switch (yaku) {
                case MCR_YAKU.ALL_TERMINALS:
                    this._removeYaku(excludedYakuList, MCR_YAKU.NO_HONORS);
                case MCR_YAKU.BIG_FOUR_WINDS:
                case MCR_YAKU.ALL_HONORS:
                case MCR_YAKU.ALL_TERMINALS_AND_HONORS:
                    excludedYakuList = excludedYakuList.filter((y) => {
                        return y !== MCR_YAKU.ALL_PUNGS &&
                            y !== MCR_YAKU.PUNG_OF_TERMINALS_OR_HONORS;
                    });
                    break;
                case MCR_YAKU.BIG_THREE_DRAGONS:
                case MCR_YAKU.LITTLE_FOUR_WINDS:
                case MCR_YAKU.BIG_THREE_WINDS:
                    this._removeYaku(excludedYakuList, MCR_YAKU.PUNG_OF_TERMINALS_OR_HONORS);
                case MCR_YAKU.LITTLE_THREE_DRAGONS:
                case MCR_YAKU.TWO_DRAGON_PUNGS:
                    this._removeYaku(excludedYakuList, MCR_YAKU.PUNG_OF_TERMINALS_OR_HONORS);
                case MCR_YAKU.DRAGON_PUNG:
                    this._removeYaku(excludedYakuList, MCR_YAKU.PUNG_OF_TERMINALS_OR_HONORS);
                    break;
                case MCR_YAKU.NINE_GATES:
                    this._removeYaku(excludedYakuList, MCR_YAKU.PUNG_OF_TERMINALS_OR_HONORS);
                case MCR_YAKU.THIRTEEN_ORPHANS:
                case MCR_YAKU.SEVEN_PAIRS:
                case MCR_YAKU.GREATER_HONORS_AND_KNITTED_TILES:
                case MCR_YAKU.LESSER_HONORS_AND_KNITTED_TILES:
                    this._removeYaku(excludedYakuList, MCR_YAKU.CONCEALED_HAND);
                    break;
                case MCR_YAKU.FOUR_KONGS:
                    this._removeYaku(excludedYakuList, MCR_YAKU.ALL_PUNGS);
                case MCR_YAKU.MELDED_HAND:
                    this._removeYaku(excludedYakuList, MCR_YAKU.SINGLE_WAIT);
                    break;
                case MCR_YAKU.SEVEN_SHIFTED_PAIRS:
                    this._removeYaku(excludedYakuList, MCR_YAKU.FULL_FLUSH);
                    this._removeYaku(excludedYakuList, MCR_YAKU.CONCEALED_HAND);
                    break;
                case MCR_YAKU.FOUR_CONCEALED_PUNGS:
                    this._removeYaku(excludedYakuList, MCR_YAKU.CONCEALED_HAND);
                case MCR_YAKU.FOUR_PURE_SHIFTED_PUNGS:
                    this._removeYaku(excludedYakuList, MCR_YAKU.ALL_PUNGS);
                    break;
                case MCR_YAKU.PURE_TERMINAL_CHOWS:
                    this._removeYaku(excludedYakuList, MCR_YAKU.FULL_FLUSH);
                case MCR_YAKU.THREE_SUITED_TERMINAL_CHOWS:
                    this._removeYaku(excludedYakuList, MCR_YAKU.ALL_CHOWS);
                    break;
                case MCR_YAKU.QUADRUPLE_CHOW:
                    excludedYakuList = excludedYakuList.filter((y) => {
                        return y !== MCR_YAKU.TILE_HOG;
                    });
                    break;
                case MCR_YAKU.ALL_EVEN_PUNGS:
                case MCR_YAKU.MIDDLE_TILES:
                case MCR_YAKU.ALL_FIVES:
                    this._removeYaku(excludedYakuList, MCR_YAKU.ALL_SIMPLES);
                    break;
                case MCR_YAKU.FULL_FLUSH:
                case MCR_YAKU.UPPER_TILES:
                case MCR_YAKU.LOWER_TILES:
                case MCR_YAKU.UPPER_FOUR:
                case MCR_YAKU.LOWER_FOUR:
                case MCR_YAKU.ALL_CHOWS:
                case MCR_YAKU.ALL_SIMPLES:
                    this._removeYaku(excludedYakuList, MCR_YAKU.NO_HONORS);
                    break;
                case MCR_YAKU.REVERSIBLE_TILES:
                    this._removeYaku(excludedYakuList, MCR_YAKU.ONE_VOIDED_SUIT);
                    break;
                case MCR_YAKU.ROBBING_THE_KONG:
                    this._removeYaku(excludedYakuList, MCR_YAKU.LAST_TILE);
                    break;
                case MCR_YAKU.PREVALENT_WIND:
                    if (completeInfo.prevalent &&
                        completeInfo.prevalent === completeInfo.seat) {
                        break;
                    }
                case MCR_YAKU.SEAT_WIND:
                    if (yakuList.includes(MCR_YAKU.LITTLE_FOUR_WINDS) ||
                        yakuList.includes(MCR_YAKU.BIG_THREE_WINDS)) {
                        break;
                    }
                    this._removeYaku(excludedYakuList, MCR_YAKU.PUNG_OF_TERMINALS_OR_HONORS);
                    break;
            }
        });
        return this._removeExcludeYakuWithCombined(excludedYakuList);
    }
    static _removeExcludeYakuWithCombined(yakuList) {
        const excludedYakuList = [...yakuList];
        if (yakuList.includes(MCR_YAKU.ALL_GREEN) && yakuList.includes(MCR_YAKU.SEVEN_PAIRS)) {
            // TODO 削除対象は全てなのか、必ず重複する1つだけなのか調査
            this._removeYaku(excludedYakuList, MCR_YAKU.TILE_HOG);
        }
        return excludedYakuList;
    }
    static _removePureDoubleChow(chowList) {
        return chowList.slice(0, -1).some((m1, i) => {
            return chowList.slice(i + 1).some((m2) => {
                if (YakuUtil.pureDoubleChow([m1, m2])) {
                    chowList.splice(i, 1);
                    return true;
                }
                return false;
            });
        });
    }
    static _removeWaitYaku(yakuList, knittedChowList, janpai) {
        if (yakuList.includes(MCR_YAKU.ALL_CHOWS) && yakuList.includes(MCR_YAKU.KNITTED_STRAIGHT) &&
            hasJanpai(toJanpaiList(knittedChowList), janpai)) {
            this._removeYaku(yakuList, MCR_YAKU.EDGE_WAIT);
            this._removeYaku(yakuList, MCR_YAKU.CLOSED_WAIT);
            this._removeYaku(yakuList, MCR_YAKU.SINGLE_WAIT);
        }
    }
    static _removeYaku(yakuList, yaku) {
        const index = yakuList.indexOf(yaku);
        if (index >= 0) {
            yakuList.splice(index, 1);
        }
    }
    static _sevenPairsYaku(janpaiList) {
        if (YakuUtil.sevenShiftedPairs(janpaiList)) {
            return MCR_YAKU.SEVEN_SHIFTED_PAIRS;
        }
        return MCR_YAKU.SEVEN_PAIRS;
    }
    static _specialYakuList(yakuList, hand, janpai) {
        // 十三幺はyakuList()で判定
        if (YakuUtil.reversibleTiles(HandUtil.allJanpaiListWith(hand, janpai))) {
            yakuList.push(MCR_YAKU.REVERSIBLE_TILES);
        }
        const count = YakuUtil.tileHogCount(hand, janpai);
        yakuList.push(...[...Array(count)].map((_) => { return MCR_YAKU.TILE_HOG; }));
        if (YakuUtil.chickenHand(yakuList)) {
            yakuList.push(MCR_YAKU.CHICKEN_HAND);
        }
        // 花牌は未実装
    }
    static _terminalsOrHonorsYaku(janpaiList) {
        if (YakuUtil.allTerminals(janpaiList)) {
            return MCR_YAKU.ALL_TERMINALS;
        }
        return YakuUtil.allTerminalsAndHonors(janpaiList) ? MCR_YAKU.ALL_TERMINALS_AND_HONORS :
            undefined;
    }
    static _threeChowsYaku(threeChows) {
        if (YakuUtil.pureTripleChow(threeChows)) {
            return MCR_YAKU.PURE_TRIPLE_CHOW;
        }
        if (YakuUtil.pureStraight(threeChows)) {
            return MCR_YAKU.PURE_STRAIGHT;
        }
        if (YakuUtil.pureShiftedChows(threeChows)) {
            return MCR_YAKU.PURE_SHIFTED_CHOWS;
        }
        if (YakuUtil.mixedStraight(threeChows)) {
            return MCR_YAKU.MIXED_STRAIGHT;
        }
        if (YakuUtil.mixedTripleChow(threeChows)) {
            return MCR_YAKU.MIXED_TRIPLE_CHOW;
        }
        if (YakuUtil.mixedShiftedChows(threeChows)) {
            return MCR_YAKU.MIXED_SHIFTED_CHOWS;
        }
        return undefined;
    }
    static _threeMentsuYakuListWithFourMentsu(fourMentsu, chow = true) {
        let yakuList = [];
        const threeMentsuCallBack = chow ? this._threeChowsYaku : this._threePungsYaku;
        fourMentsu.some((m, i) => {
            const excludedList = [...fourMentsu];
            excludedList.splice(i, 1);
            const threeMentsuYaku = threeMentsuCallBack(excludedList);
            if (threeMentsuYaku) {
                yakuList.push(threeMentsuYaku);
                excludedList.some((e) => {
                    const twoMentsu = [m, e];
                    sortMentsuList(twoMentsu);
                    const twoMentsuCallBack = chow ? this._twoChowsYaku : this._twoPungsYaku;
                    const yaku = twoMentsuCallBack(twoMentsu);
                    if (yaku) {
                        yakuList.push(yaku);
                        return true;
                    }
                    return false;
                });
                return true;
            }
            return false;
        });
        return yakuList;
    }
    static _threePungsYaku(threePungs) {
        if (YakuUtil.pureShiftedPungs(threePungs)) {
            return MCR_YAKU.PURE_SHIFTED_PUNGS;
        }
        if (YakuUtil.triplePung(threePungs)) {
            return MCR_YAKU.TRIPLE_PUNG;
        }
        if (YakuUtil.mixedShiftedPungs(threePungs)) {
            return MCR_YAKU.MIXED_SHIFTED_PUNGS;
        }
        return undefined;
    }
    static _threeSuitedTerminalChows(fourChows, head) {
        const yakuList = this._twoMentsuYakuList(fourChows, 4);
        const expectedYakuList = [MCR_YAKU.TWO_TERMINAL_CHOWS, MCR_YAKU.MIXED_DOUBLE_CHOW,
            MCR_YAKU.MIXED_DOUBLE_CHOW, MCR_YAKU.TWO_TERMINAL_CHOWS];
        return expectedYakuList.every((y, i) => { return y === yakuList[i]; }) &&
            head.five && fourChows[0].suit !== head.suit && fourChows[2].suit !== head.suit;
    }
    static _twoChowsYaku(twoChows) {
        if (YakuUtil.pureDoubleChow(twoChows)) {
            return MCR_YAKU.PURE_DOUBLE_CHOW;
        }
        if (YakuUtil.mixedDoubleChow(twoChows)) {
            return MCR_YAKU.MIXED_DOUBLE_CHOW;
        }
        if (YakuUtil.shortStraight(twoChows)) {
            return MCR_YAKU.SHORT_STRAIGHT;
        }
        if (YakuUtil.twoTerminalChows(twoChows)) {
            return MCR_YAKU.TWO_TERMINAL_CHOWS;
        }
        return undefined;
    }
    static _twoMentsuYakuList(mentsuList, max, chow = true) {
        const yakuList = [];
        const callBack = chow ? this._twoChowsYaku : this._twoPungsYaku;
        const excludedList = [...mentsuList];
        if (chow && this._removePureDoubleChow(excludedList)) {
            yakuList.push(MCR_YAKU.PURE_DOUBLE_CHOW);
        }
        excludedList.slice(0, -1).some((m, i) => {
            return excludedList.slice(i + 1).some((e) => {
                this._push(yakuList, callBack([m, e]));
                if (yakuList.length === max) {
                    return true;
                }
                return false;
            });
        });
        return yakuList;
    }
    static _twoPungsYaku(twoPungs) {
        if (YakuUtil.doublePung(twoPungs)) {
            return MCR_YAKU.DOUBLE_PUNG;
        }
        return undefined;
    }
    static _waitYaku(completePattern, janpai, completableList) {
        if (completableList.length !== 1) {
            return undefined;
        }
        if (YakuUtil.edgeWait(completePattern, janpai)) {
            return MCR_YAKU.EDGE_WAIT;
        }
        if (YakuUtil.closedWait(completePattern, janpai)) {
            return MCR_YAKU.CLOSED_WAIT;
        }
        return YakuUtil.singleWait(completePattern, janpai) ? MCR_YAKU.SINGLE_WAIT :
            undefined;
    }
    static _windsYakuList(completePattern, completeInfo) {
        const yakuList = [];
        switch (completePattern.windCount) {
            case 4:
                return [MCR_YAKU.BIG_FOUR_WINDS];
            case 3:
                yakuList.push(completePattern.head.wind ? MCR_YAKU.LITTLE_FOUR_WINDS :
                    MCR_YAKU.BIG_THREE_WINDS);
                break;
        }
        completePattern.pungList.forEach((p) => {
            if (p.head.id === completeInfo.prevalent) {
                yakuList.push(MCR_YAKU.PREVALENT_WIND);
            }
            if (p.head.id === completeInfo.seat) {
                yakuList.push(MCR_YAKU.SEAT_WIND);
            }
        });
        return yakuList;
    }
    static _yakuListWithFourChows(fourChows, head) {
        if (this._pureTerminalChows(fourChows, head)) {
            return [MCR_YAKU.PURE_TERMINAL_CHOWS];
        }
        if (YakuUtil.quadrupleChow(fourChows)) {
            return [MCR_YAKU.QUADRUPLE_CHOW];
        }
        if (YakuUtil.fourShiftedChows(fourChows)) {
            return [MCR_YAKU.FOUR_PURE_SHIFTED_CHOWS];
        }
        if (this._threeSuitedTerminalChows(fourChows, head)) {
            return [MCR_YAKU.THREE_SUITED_TERMINAL_CHOWS];
        }
        const yakuList = this._threeMentsuYakuListWithFourMentsu(fourChows);
        if (yakuList.length > 0) {
            return yakuList;
        }
        return this._twoMentsuYakuList(fourChows, 3);
    }
    static _yakuListWithFourPungs(fourPungs) {
        if (YakuUtil.fourPureShiftedPungs(fourPungs)) {
            return [MCR_YAKU.FOUR_PURE_SHIFTED_PUNGS];
        }
        const yakuList = this._threeMentsuYakuListWithFourMentsu(fourPungs, false);
        if (yakuList.length > 0) {
            return yakuList;
        }
        return this._twoMentsuYakuList(fourPungs, 2, false);
    }
    static _yakuListWithThreeChows(threeChows) {
        const yaku = this._threeChowsYaku(threeChows);
        if (yaku) {
            return [yaku];
        }
        return this._twoMentsuYakuList(threeChows, 2);
    }
    static _yakuListWithThreePungs(threePungs) {
        const yaku = this._threePungsYaku(threePungs);
        if (yaku) {
            return [yaku];
        }
        return this._twoMentsuYakuList(threePungs, 1, false);
    }
}

import * as YakuUtil from './yaku-util';
import { ZJM_YAKU } from './zjm-yaku';
export default class ZjmUtil {
    static _concealedTripletsYaku(completePattern) {
        switch (completePattern.concealedPungCount) {
            case 4:
                return ZJM_YAKU.FOUR_CONCEALED_TRIPLETS;
            case 3:
                return ZJM_YAKU.THREE_CONCEALED_TRIPLETS;
            case 2:
                return ZJM_YAKU.TWO_CONCEALED_TRIPLETS;
            default:
                return undefined;
        }
    }
    static _dragonsYaku(completePattern) {
        switch (completePattern.dragonCount) {
            case 3:
                return ZJM_YAKU.BIG_THREE_DRAGONS;
            case 2:
                if (completePattern.head.dragon) {
                    return ZJM_YAKU.SMALL_THREE_DRAGONS;
                }
            default:
                return undefined;
        }
    }
    static _honorTilesYakuList(completePattern) {
        const yakuList = [];
        this._push(yakuList, this._dragonsYaku(completePattern));
        this._push(yakuList, this._windsYaku(completePattern));
        if (completePattern.jiAll) {
            yakuList.push(ZJM_YAKU.ALL_HONORS);
        }
        return yakuList;
    }
    static _kongYaku(completePattern) {
        switch (completePattern.kongCount) {
            case 4:
                return ZJM_YAKU.FOUR_KONG;
            case 3:
                return ZJM_YAKU.THREE_KONG;
            case 2:
                return ZJM_YAKU.TWO_KONG;
            case 1:
                return ZJM_YAKU.ONE_KONG;
            default:
                return undefined;
        }
    }
    static _mentsuYakuList(completePattern) {
        const yakuList = [];
        yakuList.push(...ZjmUtil._honorTilesYakuList(completePattern));
        yakuList.push(...ZjmUtil._tripletsAndKongYakuList(completePattern));
        const chowList = completePattern.chowList;
        const pungList = completePattern.pungList;
        const head = completePattern.head;
        switch (chowList.length) {
            case 0:
                this._push(yakuList, this._yakuWithFourPungs(pungList, head));
                break;
            case 1:
                this._push(yakuList, this._yakuWithThreePungs(pungList, head));
                break;
            case 2:
                this._push(yakuList, this._twoIndenticalSequences(chowList));
                this._push(yakuList, this._smallThreeSimilarTriplets(pungList, head));
                break;
            case 3:
                this._push(yakuList, this._yakuWithThreeChows(chowList));
                break;
            case 4:
                this._push(yakuList, this._yakuWithFourChows(chowList));
                yakuList.push(ZJM_YAKU.ALL_SEQUENCES);
                break;
        }
        ZjmUtil._push(yakuList, YakuUtil.terminalsYaku(completePattern));
        return yakuList;
    }
    static _prevNumberMentsuYaku(callBack, mentsuList, head) {
        for (let i = 0; i < mentsuList.length; i++) {
            const removed = mentsuList.splice(i, 1);
            let yaku;
            if (head) {
                yaku = callBack(mentsuList, head);
            }
            else {
                yaku = callBack(mentsuList);
            }
            if (yaku) {
                return yaku;
            }
            mentsuList.splice(i, 0, removed[0]);
        }
        return undefined;
    }
    static _push(yakuList, yaku) {
        if (yaku) {
            yakuList.push(yaku);
        }
    }
    static _smallThreeSimilarTriplets(twoPungs, head) {
        if (YakuUtil.doublePung(twoPungs) &&
            twoPungs[0].head.number === head.number) {
            return ZJM_YAKU.SMALL_THREE_SIMILAR_TRIPLETS;
        }
        return undefined;
    }
    static _threeChowsYaku(threeChows) {
        if (YakuUtil.pureTripleChow(threeChows)) {
            return ZJM_YAKU.THREE_INDENTICAL_SEQUENCES;
        }
        if (YakuUtil.pureStraight(threeChows)) {
            return ZJM_YAKU.NINE_TILE_STRAIGHT;
        }
        if (YakuUtil.mixedTripleChow(threeChows)) {
            return ZJM_YAKU.THREE_SIMILAR_SEQUENCES;
        }
        return undefined;
    }
    static _threePungsYaku(threePungs) {
        if (YakuUtil.triplePung(threePungs)) {
            return ZJM_YAKU.THREE_SIMILAR_TRIPLETS;
        }
        if (YakuUtil.pureShiftedPungs(threePungs)) {
            return ZJM_YAKU.THREE_CONCEALED_TRIPLETS;
        }
        return undefined;
    }
    static _tripletsAndKongYakuList(completePattern) {
        const yakuList = [];
        if (completePattern.pungList.length === 4) {
            yakuList.push(ZJM_YAKU.ALL_TRIPLETS);
        }
        this._push(yakuList, this._concealedTripletsYaku(completePattern));
        this._push(yakuList, this._kongYaku(completePattern));
        return yakuList;
    }
    static _twoIndenticalSequences(twoChows) {
        if (YakuUtil.pureDoubleChow(twoChows)) {
            return ZJM_YAKU.TWO_INDENTICAL_SEQUENCES;
        }
        return undefined;
    }
    static _twoMentsuYakuWithFourMentsu(callBack, fourMentsu, head) {
        for (let i = 0; i < fourMentsu.length; i++) {
            const firstRemoved = fourMentsu.splice(i, 1);
            for (let j = 0; j < fourMentsu.length; j++) {
                const secondRemoved = fourMentsu.splice(j, 1);
                let yaku;
                if (head) {
                    yaku = callBack(fourMentsu, head);
                }
                else {
                    yaku = callBack(fourMentsu);
                }
                if (yaku) {
                    return yaku;
                }
                fourMentsu.splice(j, 0, secondRemoved[0]);
            }
            fourMentsu.splice(i, 0, firstRemoved[0]);
        }
        return undefined;
    }
    static _windsYaku(completePattern) {
        switch (completePattern.windCount) {
            case 4:
                return ZJM_YAKU.BIG_FOUR_WINDS;
            case 3:
                if (completePattern.head.wind) {
                    return ZJM_YAKU.SMALL_FOUR_WINDS;
                }
                return ZJM_YAKU.BIG_THREE_WINDS;
            case 2:
                if (completePattern.head.wind) {
                    return ZJM_YAKU.SMALL_THREE_WINDS;
                }
            default:
                return undefined;
        }
    }
    static _yakuWithFourChows(fourChows) {
        if (YakuUtil.quadrupleChow(fourChows)) {
            return ZJM_YAKU.FOUR_INDENTICAL_SEQUENCES;
        }
        if (YakuUtil.twoIdenticalSequencesTwice(fourChows)) {
            return ZJM_YAKU.TWO_INDENTICAL_SEQUENCES_TWICE;
        }
        const _threeChowsYaku = this._threeChowsYaku;
        const yaku = this._prevNumberMentsuYaku(_threeChowsYaku, fourChows, undefined);
        if (yaku) {
            return yaku;
        }
        const callBack = this._twoIndenticalSequences;
        return this._twoMentsuYakuWithFourMentsu(callBack, fourChows, undefined);
    }
    static _yakuWithFourPungs(fourPungs, head) {
        if (YakuUtil.fourPureShiftedPungs(fourPungs)) {
            return ZJM_YAKU.FOUR_CONSECUTIVE_TRIPLETS;
        }
        const _threePungsYaku = this._threePungsYaku;
        const yaku = this._prevNumberMentsuYaku(_threePungsYaku, fourPungs, head);
        if (yaku) {
            return yaku;
        }
        const callBack = this._smallThreeSimilarTriplets;
        return this._twoMentsuYakuWithFourMentsu(callBack, fourPungs, head);
    }
    static _yakuWithThreeChows(threeChows) {
        const yaku = this._threeChowsYaku(threeChows);
        if (yaku) {
            return yaku;
        }
        const callBack = this._twoIndenticalSequences;
        return this._prevNumberMentsuYaku(callBack, threeChows, undefined);
    }
    static _yakuWithThreePungs(threePungs, head) {
        const yaku = this._threePungsYaku(threePungs);
        if (yaku) {
            return yaku;
        }
        const callBack = this._smallThreeSimilarTriplets;
        return this._prevNumberMentsuYaku(callBack, threePungs, head);
    }
}

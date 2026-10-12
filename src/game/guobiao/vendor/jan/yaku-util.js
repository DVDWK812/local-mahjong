/*
Copyright 2021 masaue

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */
import { COMPLETE_TYPE } from './complete-type';
import { allJanpaiListWith } from './hand-util';
import { Janpai } from './janpai';
import { JANPAI_ID } from './janpai-id';
import * as JanUtil from './jan-util';
import { KNITTED_STRAIGHT } from './knitted-straight';
import * as MentsuUtil from './mentsu-util';
import { SUIT } from './suit';
import { ZJM_YAKU } from './zjm-yaku';
export function allFives(completePattern) {
    return completePattern.head.five &&
        completePattern.mentsuList.every((m) => { return m.five; });
}
export function allGreen(janpaiList) {
    const greenList = [
        new Janpai(JANPAI_ID.SOU_02), new Janpai(JANPAI_ID.SOU_03),
        new Janpai(JANPAI_ID.SOU_04), new Janpai(JANPAI_ID.SOU_06),
        new Janpai(JANPAI_ID.SOU_08), new Janpai(JANPAI_ID.FA),
    ];
    return JanUtil.uniqueList(janpaiList).every((j) => {
        return JanUtil.hasJanpai(greenList, j);
    });
}
export function allHonors(janpaiList) {
    return janpaiList.every((j) => { return j.ji; });
}
export function allSimples(janpaiList) {
    return !janpaiList.some((j) => { return j.yao; });
}
export function allTerminals(janpaiList) {
    return janpaiList.every((j) => { return j.yao && !j.ji; });
}
export function allTerminalsAndHonors(janpaiList) {
    return janpaiList.every((j) => { return j.yao; }) &&
        !allHonors(janpaiList) &&
        !allTerminals(janpaiList);
}
export function allTypes(janpaiList) {
    return JanUtil.suitCount(janpaiList) === 4 &&
        janpaiList.some((j) => { return j.wind; }) &&
        janpaiList.some((j) => { return j.dragon; });
}
export function chickenHand(yakuList) {
    return yakuList.length === 0;
}
export function closedWait(completePattern, janpai) {
    return completePattern.chowList.some((c) => {
        return c.middle.number === janpai.number && c.concealedChow;
    });
}
export function concealedHand(hand, completeInfo) {
    return hand.callCount === 0 && !completeInfo.type.tsumo;
}
export function doublePung(doublePung) {
    return mixedTripleChow(doublePung);
}
export function edgeWait(completePattern, janpai) {
    return completePattern.chowList.some((c) => {
        return (c.head.number === 1 && c.head.next.next.equals(janpai) ||
            c.head.number === 7 && c.head.equals(janpai)) && c.concealedChow;
    });
}
export function fourPureShiftedPungs(fourPungs) {
    return fullFlush(MentsuUtil.toJanpaiList(fourPungs)) &&
        MentsuUtil.shifted(fourPungs, 4, 1);
}
export function fourShiftedChows(fourChows) {
    return fullFlush(MentsuUtil.toJanpaiList(fourChows)) &&
        MentsuUtil.shifted(fourChows, 4, 2);
}
export function fullFlush(janpaiList) {
    return JanUtil.suitCount(janpaiList) === 1 && !janpaiList[0].ji;
}
export function fullyConcealed(hand, completeInfo) {
    return hand.callCount === 0 && completeInfo.type.tsumo;
}
// honorsAndKnittedTiles()がtrueなjanpaiListのみ保証する
export function greaterHonorsAndKnittedTiles(janpaiList) {
    // janpaiListがuniqueであることはhonorsAndKnittedTiles()で判定済み
    return janpaiList.filter((j) => { return j.ji; }).length === 7;
}
export function halfFlush(janpaiList) {
    return JanUtil.suitCount(janpaiList) === 2 &&
        JanUtil.hasSuit(janpaiList, SUIT.JI);
}
export function honorsAndKnittedTiles(janpaiList) {
    if (janpaiList.length !== JanUtil.uniqueList(janpaiList).length) {
        return false;
    }
    const numberTileList = janpaiList.filter((j) => { return !j.ji; });
    switch (numberTileList.length) {
        case 7:
            return !!_knittedStraight(numberTileList, _knittedStraight);
        case 8:
            return !!_knittedStraight(numberTileList);
        case 9:
            return !!knittedStraight(numberTileList);
    }
    return false;
}
export function incidentalBonusesYakuList(completeInfo) {
    switch (completeInfo.type) {
        case COMPLETE_TYPE.FINAL_DRAW_AND_WIN_ON_KONG:
            return [ZJM_YAKU.FINAL_DRAW, ZJM_YAKU.WIN_ON_KONG];
        case COMPLETE_TYPE.FINAL_DRAW:
            return [ZJM_YAKU.FINAL_DRAW];
        case COMPLETE_TYPE.FINAL_DISCARD:
            return [ZJM_YAKU.FINAL_DISCARD];
        case COMPLETE_TYPE.WIN_ON_KONG:
            return [ZJM_YAKU.WIN_ON_KONG];
        case COMPLETE_TYPE.ROBBING_A_KONG:
            return [ZJM_YAKU.ROBBING_A_KONG];
    }
    return [];
}
export function knittedStraight(janpaiList) {
    const knittedTypes = Object.keys(KNITTED_STRAIGHT);
    return knittedTypes.find((k) => {
        return KNITTED_STRAIGHT[k].every((j) => {
            return JanUtil.hasJanpai(janpaiList, j);
        });
    });
}
export function lastTile(completeInfo) {
    return completeInfo.last;
}
export function lowerFour(janpaiList) {
    return _minToMax(janpaiList, 1, 4);
}
export function lowerTiles(janpaiList) {
    return _minToMax(janpaiList, 1, 3);
}
export function meldedHand(hand, completeInfo) {
    return hand.callCount === 4 && !completeInfo.type.tsumo;
}
export function middleTiles(janpaiList) {
    return _minToMax(janpaiList, 4, 6);
}
export function mixedDoubleChow(doubleChow) {
    return mixedTripleChow(doubleChow);
}
export function mixedShiftedChows(threeChows) {
    return MentsuUtil.mixed(threeChows) && MentsuUtil.shifted(threeChows, 3, 1);
}
export function mixedShiftedPungs(threePungs) {
    return mixedShiftedChows(threePungs);
}
export function mixedStraight(threeChows) {
    return MentsuUtil.mixed(threeChows) && MentsuUtil.straight(threeChows);
}
export function mixedTripleChow(tripleChow) {
    return MentsuUtil.mixed(tripleChow) && MentsuUtil.multiplicative(tripleChow);
}
export function nineGates(janpaiList) {
    const numberList = JanUtil.numbers(janpaiList);
    return [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9].every((n, i) => {
        return n === numberList[i];
    }) && fullFlush(janpaiList);
}
export function noHonors(janpaiList) {
    return janpaiList.every((j) => { return !j.ji; });
}
export function oneVoidedSuit(janpaiList) {
    return JanUtil.suitCount(janpaiList.filter((j) => { return !j.ji; })) === 2;
}
export function pureDoubleChow(doubleChow) {
    return doubleChow[0].head.equals(doubleChow[1].head);
}
export function pureShiftedChows(threeChows) {
    return fullFlush(MentsuUtil.toJanpaiList(threeChows)) &&
        MentsuUtil.shifted(threeChows, 3, 2);
}
export function pureShiftedPungs(threePungs) {
    return fullFlush(MentsuUtil.toJanpaiList(threePungs)) &&
        MentsuUtil.shifted(threePungs, 3, 1);
}
export function pureStraight(threeChows) {
    return fullFlush(MentsuUtil.toJanpaiList(threeChows)) &&
        MentsuUtil.straight(threeChows);
}
export function pureTripleChow(tripleChow) {
    return tripleChow[0].head.equals(tripleChow[1].head) &&
        tripleChow[1].head.equals(tripleChow[2].head);
}
export function quadrupleChow(quadrupleChow) {
    return quadrupleChow[0].head.equals(quadrupleChow[1].head) &&
        quadrupleChow[1].head.equals(quadrupleChow[2].head) &&
        quadrupleChow[2].head.equals(quadrupleChow[3].head);
}
export function reversibleTiles(janpaiList) {
    const reversibleList = [
        new Janpai(JANPAI_ID.PIN_01), new Janpai(JANPAI_ID.PIN_02),
        new Janpai(JANPAI_ID.PIN_03), new Janpai(JANPAI_ID.PIN_04),
        new Janpai(JANPAI_ID.PIN_05), new Janpai(JANPAI_ID.PIN_08),
        new Janpai(JANPAI_ID.PIN_09), new Janpai(JANPAI_ID.SOU_02),
        new Janpai(JANPAI_ID.SOU_04), new Janpai(JANPAI_ID.SOU_05),
        new Janpai(JANPAI_ID.SOU_06), new Janpai(JANPAI_ID.SOU_08),
        new Janpai(JANPAI_ID.SOU_09), new Janpai(JANPAI_ID.BAI),
    ];
    return JanUtil.uniqueList(janpaiList).every((j) => {
        return JanUtil.hasJanpai(reversibleList, j);
    });
}
export function selfDrawn(hand, completeInfo) {
    return hand.callCount !== 0 && completeInfo.type === COMPLETE_TYPE.DRAW;
}
export function sevenPairs(janpaiList) {
    let pairCount = 0;
    JanUtil.uniqueList(janpaiList).every((u) => {
        let count = JanUtil.count(janpaiList, u);
        if (count % 2 !== 0) {
            return false;
        }
        pairCount += count / 2;
        return true;
    });
    return pairCount === 7;
}
// sevenPairs()がtrueなjanpaiListのみ保証する
export function sevenShiftedPairs(janpaiList) {
    if (janpaiList[0].number > 3) {
        return false;
    }
    const uniqueList = JanUtil.uniqueList(janpaiList);
    return uniqueList.slice(0, -1).every((j, i) => {
        return j.next.equals(uniqueList[i + 1]);
    }) && uniqueList.length === 7;
}
export function shortStraight(twoChows) {
    return fullFlush(MentsuUtil.toJanpaiList(twoChows)) &&
        MentsuUtil.shortStraight(twoChows);
}
export function singleWait(completePattern, janpai) {
    return completePattern.head.equals(janpai);
}
export function terminalsYaku(completePattern) {
    if (completePattern.yaoAll) {
        if (completePattern.hasJi) {
            if (completePattern.pungList.length === 4) {
                return ZJM_YAKU.MIXED_GREATER_TERMINALS;
            }
            return ZJM_YAKU.MIXED_LESSER_TERMINALS;
        }
        else {
            if (completePattern.pungList.length === 4) {
                return ZJM_YAKU.PURE_GREATER_TERMINALS;
            }
            return ZJM_YAKU.PURE_LESSER_TERMINALS;
        }
    }
    return undefined;
}
export function thirteenOrphans(janpaiList) {
    const uniqueList = JanUtil.uniqueList(janpaiList);
    return uniqueList.length === 13 && uniqueList.every((u) => {
        return u.yao;
    });
}
export function tileHogCount(hand, janpai) {
    const janpaiList = allJanpaiListWith(hand, janpai);
    return JanUtil.uniqueList(janpaiList).filter((u) => {
        return JanUtil.count(janpaiList, u) === 4 &&
            !hand.fixedList.some((f) => { return f.head.equals(u) && f.kong; });
    }).length;
}
export function triplePung(triplePung) {
    return mixedTripleChow(triplePung);
}
export function twoIdenticalSequencesTwice(quadrupleChow) {
    const headList = quadrupleChow.map((m) => { return m.head; });
    return JanUtil.uniqueList(headList).every((u) => {
        return headList.filter((h) => { return h.equals(u); }).length === 2;
    });
}
export function twoTerminalChows(twoChows) {
    return fullFlush(MentsuUtil.toJanpaiList(twoChows)) &&
        MentsuUtil.terminalChows(twoChows);
}
export function upperFour(janpaiList) {
    return _minToMax(janpaiList, 6);
}
export function upperTiles(janpaiList) {
    return _minToMax(janpaiList, 7);
}
function _knittedStraight(janpaiList, callback = knittedStraight) {
    const knittedTypes = Object.keys(KNITTED_STRAIGHT);
    return knittedTypes.find((_) => {
        return JanUtil.getAllJanpai().some((j) => {
            if (j.ji || JanUtil.hasJanpai(janpaiList, j)) {
                return false;
            }
            return callback(JanUtil.janpaiListWith(janpaiList, j));
        });
    });
}
function _minToMax(janpaiList, min, max = undefined) {
    const numberList = JanUtil.numbers(janpaiList);
    return max ? numberList.every((n) => { return min <= n && n <= max; }) :
        numberList.every((n) => { return n >= min; });
}

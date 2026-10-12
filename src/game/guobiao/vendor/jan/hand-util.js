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
import { CompleteInfo } from './complete-info';
import { CompletePattern } from './complete-pattern';
import { Janpai } from './janpai';
import { JANPAI_ID } from './janpai-id';
import { count, janpaiListWith as janPaiListWith, remove, uniqueList } from './jan-util';
import { KNITTED_STRAIGHT } from './knitted-straight';
import { Mentsu } from './mentsu';
import * as YakuUtil from './yaku-util';
export function allJanpaiListWith(hand, janpai) {
    return janPaiListWith(hand.allJanpaiList, janpai);
}
export function completable(hand, janpai) {
    const janpaiList = janpaiListWith(hand, janpai);
    const excludeHeadMap = _excludeHeadMap(janpaiList);
    if (excludeHeadMap.size === 0) {
        return YakuUtil.honorsAndKnittedTiles(janpaiList);
    }
    const completable = [...excludeHeadMap].some(([k, v]) => {
        if (v.length === 0) {
            // 裸単騎状態で和了
            return true;
        }
        const pungList = _pungList([...v]);
        // JANPAI_IDは何でも問題ない
        const completeInfo = new CompleteInfo(new Janpai(JANPAI_ID.MAN_01));
        return [...Array(2 ** pungList.length).keys()].some((number) => {
            return _completePattern(v, k, pungList, number, completeInfo, hand);
        });
    });
    if (completable) {
        return true;
    }
    if (YakuUtil.sevenPairs(janpaiList)) {
        return true;
    }
    return YakuUtil.thirteenOrphans(janpaiList);
}
// completable()でtrueだったhand, completeInfo.janpaiのみ保証する
export function completePatternList(hand, completeInfo) {
    const completePatternList = [];
    const janpaiList = janpaiListWith(hand, completeInfo.janpai);
    const excludeHeadMap = _excludeHeadMap(janpaiList);
    excludeHeadMap.forEach((v, k) => {
        const pungList = _pungList([...v]);
        [...Array(2 ** pungList.length).keys()].forEach((number) => {
            const completePattern = _completePattern(v, k, pungList, number, completeInfo, hand);
            if (completePattern) {
                completePatternList.push(completePattern);
            }
        });
    });
    return completePatternList;
}
export function janpaiListWith(hand, janpai) {
    return janPaiListWith(hand.janpaiList, janpai);
}
function _chowable(head, middle, tail) {
    if (head.ji || middle.ji || tail.ji) {
        return false;
    }
    return middle.equals(head.next) && tail.equals(middle.next);
}
function _chowList(janpaiList) {
    const chowList = [];
    let found;
    do {
        const uniqueJanpaiList = uniqueList(janpaiList);
        found = uniqueJanpaiList.slice(0, -2).some((head, index) => {
            const middle = uniqueJanpaiList[index + 1];
            const tail = uniqueJanpaiList[index + 2];
            if (_chowable(head, middle, tail)) {
                [head, middle, tail].forEach((j) => {
                    remove(janpaiList, j);
                });
                chowList.push(Mentsu.createChowMentsu(head, true));
                return true;
            }
            return false;
        });
    } while (found && janpaiList.length !== 0);
    return chowList;
}
function _completePattern(janpaiList, head, pungList, number, completeInfo, hand) {
    const use = number.toString(2).padStart(pungList.length, "0");
    const useList = use.split('').map((n) => { return parseInt(n); });
    const removeList = pungList.filter((p, i) => { return useList[i]; });
    const copyList = [...janpaiList];
    const pungMentsuList = _PungMentsuList(copyList, removeList, completeInfo);
    pungMentsuList.push(...hand.fixedList);
    const mentsuList = _mentsuList(copyList, pungMentsuList);
    if (mentsuList.length !== 0) {
        return new CompletePattern(mentsuList, head);
    }
    return undefined;
}
function _createLightPungMentsu(janpaiList, janpai, completeInfo) {
    return count(janpaiList, janpai) === 3 &&
        completeInfo.janpai.equals(janpai) && !completeInfo.type.tsumo;
}
function _excludeHeadMap(janpaiList) {
    const excludeHeadMap = new Map();
    uniqueList(janpaiList).forEach((j) => {
        if (count(janpaiList, j) >= 2) {
            const excludeHeadList = [...janpaiList];
            remove(excludeHeadList, j, 2);
            excludeHeadMap.set(j, excludeHeadList);
        }
    });
    return excludeHeadMap;
}
function _knittedChowList(janpaiList, knittedType) {
    const chowList = [];
    knittedType.split('').forEach((k, i) => {
        const numberChar = `${i + 1}`;
        const suitChar = `${k.toLowerCase()}`;
        chowList.push(Mentsu.createKnittedChowMentsu(new Janpai(`${numberChar}${suitChar}`)));
    });
    _removeKnittedStraight(janpaiList, knittedType);
    return chowList;
}
function _pungList(janpaiList) {
    return uniqueList(janpaiList).filter((j) => {
        if (count(janpaiList, j) >= 3) {
            remove(janpaiList, j, 3);
            return true;
        }
        return false;
    });
}
function _PungMentsuList(janpaiList, pungList, completeInfo) {
    return pungList.map((p) => {
        const light = _createLightPungMentsu(janpaiList, p, completeInfo);
        // pungListを必ず削除できることは_pungList()で検証済み
        remove(janpaiList, p, 3);
        return Mentsu.createPungMentsu(p, !light);
    });
}
function _removeKnittedStraight(janpaiList, knittedType) {
    KNITTED_STRAIGHT[knittedType].forEach((j) => {
        remove(janpaiList, j);
    });
}
function _mentsuList(janpaiList, fixedList) {
    const copyList1 = [...janpaiList];
    const chowList1 = _chowList(copyList1);
    if (copyList1.length === 0) {
        chowList1.push(...fixedList);
        return chowList1;
    }
    const copyList2 = [...janpaiList];
    const knittedType = YakuUtil.knittedStraight(copyList2);
    if (!knittedType) {
        return [];
    }
    const chowList2 = _knittedChowList(copyList2, knittedType);
    chowList2.push(..._chowList(copyList2));
    if (copyList2.length === 0) {
        chowList2.push(...fixedList);
        return chowList2;
    }
    return [];
}

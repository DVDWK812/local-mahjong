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
import { CALL_TYPE } from './call-type';
import { completable } from './hand-util';
import * as JanUtil from './jan-util';
import { toJanpaiList } from './mentsu-util';
export class Hand {
    constructor(_janpaiList) {
        this._janpaiList = _janpaiList;
        this._fixedList = [];
        this._waitTable = {
            [CALL_TYPE.RON]: [],
            [CALL_TYPE.CHI]: [],
            [CALL_TYPE.PON]: [],
            [CALL_TYPE.KAN_LIGHT]: [],
        };
    }
    allCount(janpai) {
        return JanUtil.count(this.allJanpaiList, janpai);
    }
    calledCount(janpai) {
        return JanUtil.count(this.calledJanpaiList, janpai);
    }
    count(janpai) {
        return JanUtil.count(this._janpaiList, janpai);
    }
    discard(janpai) {
        return JanUtil.discard(this._janpaiList, janpai);
    }
    fix(fixed) {
        this._fixedList.push(fixed);
    }
    includes(janpai) {
        return JanUtil.hasJanpai(this._janpaiList, janpai);
    }
    kongableList(tsumo) {
        return JanUtil.getAllJanpai().filter((j) => {
            return this._kongable(tsumo, j);
        });
    }
    pop() {
        return this._janpaiList.pop();
    }
    push(janpai) {
        this._janpaiList.push(janpai);
    }
    remove(janpai, count = 1) {
        JanUtil.remove(this._janpaiList, janpai, count);
    }
    toObject() {
        return {
            fixedObjectList: JanUtil.objectedList(this._fixedList),
            janpaiObjectList: JanUtil.objectedList(this._janpaiList),
            waitObjectTable: {
                [CALL_TYPE.RON]: JanUtil.objectedList(this._waitTable[CALL_TYPE.RON]),
                [CALL_TYPE.CHI]: JanUtil.objectedList(this._waitTable[CALL_TYPE.CHI]),
                [CALL_TYPE.PON]: JanUtil.objectedList(this._waitTable[CALL_TYPE.PON]),
                [CALL_TYPE.KAN_LIGHT]: JanUtil.objectedList(this._waitTable[CALL_TYPE.KAN_LIGHT]),
            },
        };
    }
    updateWaitTable() {
        this._waitTable[CALL_TYPE.RON] = this.completableList;
        this._waitTable[CALL_TYPE.CHI] = this._chowableList();
        this._waitTable[CALL_TYPE.PON] = this._pungableList();
        this._waitTable[CALL_TYPE.KAN_LIGHT] = this._lightKongableList();
    }
    get allJanpaiList() {
        const janpaiList = [...this._janpaiList];
        janpaiList.push(...toJanpaiList(this._fixedList));
        JanUtil.sortJanpaiList(janpaiList);
        return janpaiList;
    }
    get callCount() {
        return this.calledList.length;
    }
    get calledJanpaiList() {
        const janpaiList = [];
        janpaiList.push(...toJanpaiList(this.calledList));
        JanUtil.sortJanpaiList(janpaiList);
        return janpaiList;
    }
    get completableList() {
        return JanUtil.getAllJanpai().filter((j) => {
            return this.allCount(j) < 4 && completable(this, j);
        });
    }
    get calledList() {
        return this._fixedList.filter((f) => { return !f.dark; });
    }
    get fixedList() {
        return this._fixedList;
    }
    get janpaiList() {
        return this._janpaiList;
    }
    get waitTable() {
        return this._waitTable;
    }
    _chowableList() {
        return JanUtil.getAllJanpai().filter((j) => {
            return JanUtil.chowable(this, j);
        });
    }
    _kongable(tsumo, janpai) {
        // 暗槓判定
        switch (this.count(janpai)) {
            case 3:
                return janpai.equals(tsumo);
            case 4:
                return true;
            default:
                break;
        }
        // 加槓判定
        return this._fixedList.some((f) => {
            if (f.isKongableTo(janpai)) {
                if (janpai.equals(tsumo)) {
                    return true;
                }
                if (this.includes(janpai)) {
                    return true;
                }
            }
            return false;
        });
    }
    _lightKongableList() {
        return JanUtil.getAllJanpai().filter((j) => {
            return this.count(j) === 3;
        });
    }
    _pungableList() {
        return JanUtil.getAllJanpai().filter((j) => {
            return this.count(j) >= 2;
        });
    }
}

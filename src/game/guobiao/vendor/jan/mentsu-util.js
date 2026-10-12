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
import { JANPAI_ID } from './janpai-id';
export function mixed(mentsuList) {
    const suitSet = new Set(mentsuList.filter((m) => {
        return !m.hasJi;
    }).map((m) => { return m.suit; }));
    return suitSet.size === mentsuList.length;
}
export function multiplicative(mentsuList) {
    const numberSet = new Set(mentsuList.map((c) => { return c.head.number; }));
    return numberSet.size === 1;
}
export function shifted(mentsuList, shiftedCount, maxShiftNumber) {
    for (let number = 1; number <= maxShiftNumber; number++) {
        if (_shifted(mentsuList, shiftedCount, number)) {
            return true;
        }
    }
    return false;
}
export function shortStraight(mentsuList) {
    return _shifted(mentsuList, 2, 3);
}
export function sortMentsuList(target) {
    target.sort((s, t) => {
        const sIndex = Object.values(JANPAI_ID).findIndex((id) => { return id === s.head.id; });
        const tIndex = Object.values(JANPAI_ID).findIndex((id) => { return id === t.head.id; });
        return (sIndex < tIndex) ? -1 : 1;
    });
}
export function straight(mentsuList) {
    return _shifted(mentsuList, 3, 3);
}
export function terminalChows(mentsuList) {
    return _shifted(mentsuList, 2, 6);
}
export function toJanpaiList(mentsuList) {
    return mentsuList.map((m) => { return m.janpaiList; }).flat();
}
function _shifted(mentsuList, shiftedCount, shiftNumber) {
    const numberList = mentsuList.map((m) => { return m.head.number; });
    numberList.sort();
    const expectedList = [];
    const number = numberList[0];
    for (let count = 0; count < shiftedCount; count++) {
        expectedList.push(number + shiftNumber * count);
    }
    return numberList.toString() === expectedList.toString();
}

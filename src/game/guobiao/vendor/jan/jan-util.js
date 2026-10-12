import { Janpai } from './janpai';
import { JANPAI_ID } from './janpai-id';
import { Mentsu } from './mentsu';
import { WIND } from './wind';
export function chowable(hand, janpai) {
    if (janpai.ji) {
        return false;
    }
    switch (janpai.number) {
        case 1:
            return hand.includes(janpai.next) && hand.includes(janpai.next.next);
        case 2:
            return hand.includes(janpai.next) && hand.includes(janpai.next.next) ||
                hand.includes(janpai.prev) && hand.includes(janpai.next);
        case 8:
            return hand.includes(janpai.prev) && hand.includes(janpai.next) ||
                hand.includes(janpai.prev) && hand.includes(janpai.prev.prev);
        case 9:
            return hand.includes(janpai.prev) && hand.includes(janpai.prev.prev);
        default:
            return hand.includes(janpai.next) && hand.includes(janpai.next.next) ||
                hand.includes(janpai.prev) && hand.includes(janpai.next) ||
                hand.includes(janpai.prev) && hand.includes(janpai.prev.prev);
    }
}
export function chowableList(hand, janpai) {
    const chowableList = [];
    if (janpai.ji) {
        return chowableList;
    }
    const number = janpai.number;
    if (number > 2 && hand.includes(janpai.prev.prev) && hand.includes(janpai.prev)) {
        chowableList.push(Mentsu.createChowMentsu(janpai.prev.prev));
    }
    if (1 < number && number < 9 && hand.includes(janpai.prev) && hand.includes(janpai.next)) {
        chowableList.push(Mentsu.createChowMentsu(janpai.prev));
    }
    if (number < 8 && hand.includes(janpai.next) && hand.includes(janpai.next.next)) {
        chowableList.push(Mentsu.createChowMentsu(janpai));
    }
    return chowableList;
}
export function count(target, janpai) {
    return target.filter((j) => { return j.equals(janpai); }).length;
}
export function createDeck() {
    const deck = [];
    getAllJanpai().forEach((janpai) => {
        for (let i = 0; i < 4; i++) {
            deck.push(janpai.clone());
        }
    });
    return deck;
}
export function discard(target, janpai) {
    const found = target.find((j, index) => {
        if (j.equals(janpai)) {
            target.splice(index, 1);
            return true;
        }
        return false;
    });
    return found ? found.clone() : undefined;
}
export function getAllJanpai() {
    return Object.values(JANPAI_ID).map((id) => { return new Janpai(id); });
}
export function hasJanpai(target, janpai) {
    return target.some((j) => { return j.equals(janpai); });
}
export function hasSuit(target, suit) {
    return target.map((j) => { return j.suit; }).includes(suit);
}
export function janpaiList(objectList) {
    return objectList.map((o) => { return new Janpai(o.id, o.red); });
}
export function janpaiListWith(target, janpai) {
    const janpaiListWith = [...target];
    janpaiListWith.push(janpai);
    sortJanpaiList(janpaiListWith);
    return janpaiListWith;
}
export function nextWind(wind) {
    switch (wind) {
        case WIND.TON:
            return WIND.NAN;
        case WIND.NAN:
            return WIND.SHA;
        case WIND.SHA:
            return WIND.PEI;
        case WIND.PEI:
            return WIND.TON;
    }
}
export function numbers(target) {
    return target.map((j) => { return j.number; });
}
export function objectedList(target) {
    return target.map((t) => {
        return t.toObject();
    });
}
export function objectedTable(targetTable) {
    return Object.fromEntries(Object.entries(targetTable).map(([k, v]) => {
        return [k, v.toObject()];
    }));
}
export function remove(target, janpai, count = 1) {
    for (let i = 0; i < count; i++) {
        discard(target, janpai);
    }
}
export function shuffleList(target) {
    for (let n = target.length; n > 0; n--) {
        const s = n - 1;
        const t = Math.floor(Math.random() * n);
        const temp = target[s];
        target[s] = target[t];
        target[t] = temp;
    }
}
export function sortJanpaiList(target) {
    target.sort((s, t) => {
        const sIndex = Object.values(JANPAI_ID).findIndex((id) => { return id === s.id; });
        const tIndex = Object.values(JANPAI_ID).findIndex((id) => { return id === t.id; });
        return (sIndex < tIndex) ? -1 : 1;
    });
}
export function suitCount(target) {
    return (new Set(target.map((j) => { return j.suit; }))).size;
}
export function uniqueList(target) {
    const result = [];
    target.forEach((t) => {
        if (!result.some((r) => { return r.equals(t); })) {
            result.push(t);
        }
    });
    return result;
}

import { Hand, HandObject } from './hand';
import { Janpai, JanpaiObject } from './janpai';
import { Mentsu, MentsuObject } from './mentsu';
import { Suit } from './suit';
import { Wind } from './wind';
export declare function chowable(hand: Hand, janpai: Janpai): boolean;
export declare function chowableList(hand: Hand, janpai: Janpai): Mentsu[];
export declare function count(target: Janpai[], janpai: Janpai): number;
export declare function createDeck(): Janpai[];
export declare function discard(target: Janpai[], janpai: Janpai): Janpai | undefined;
export declare function getAllJanpai(): Janpai[];
export declare function hasJanpai(target: Janpai[], janpai: Janpai): boolean;
export declare function hasSuit(target: Janpai[], suit: Suit): boolean;
export declare function janpaiList(objectList: JanpaiObject[]): Janpai[];
export declare function janpaiListWith(target: Janpai[], janpai: Janpai): Janpai[];
export declare function nextWind(wind: Wind): "東" | "南" | "西" | "北";
export declare function numbers(target: Janpai[]): number[];
type ToObjectedList<T> = T extends Janpai ? JanpaiObject : MentsuObject;
export declare function objectedList<T extends Janpai | Mentsu>(target: T[]): ToObjectedList<T>[];
type ToObjectedTable<T> = T extends Janpai ? JanpaiObject : HandObject;
export declare function objectedTable<T extends Janpai | Hand>(targetTable: {
    [target: string]: T;
}): {
    [k: string]: ToObjectedTable<T>;
};
export declare function remove(target: Janpai[], janpai: Janpai, count?: number): void;
export declare function shuffleList(target: Janpai[]): void;
export declare function sortJanpaiList(target: Janpai[]): void;
export declare function suitCount(target: Janpai[]): number;
export declare function uniqueList(target: Janpai[]): Janpai[];
export {};
//# sourceMappingURL=jan-util.d.ts.map
import { CALL_TYPE } from './call-type';
import { Janpai, JanpaiObject } from './janpai';
import { Mentsu, MentsuObject } from './mentsu';
export type HandObject = {
    fixedObjectList: MentsuObject[];
    janpaiObjectList: JanpaiObject[];
    waitObjectTable: WaitObjectTable;
};
export type WaitTable = {
    [CALL_TYPE.RON]: Janpai[];
    [CALL_TYPE.CHI]: Janpai[];
    [CALL_TYPE.PON]: Janpai[];
    [CALL_TYPE.KAN_LIGHT]: Janpai[];
};
export type WaitObjectTable = {
    [Property in keyof WaitTable]: JanpaiObject[];
};
export declare class Hand {
    private _janpaiList;
    private _fixedList;
    private _waitTable;
    constructor(_janpaiList: Janpai[]);
    allCount(janpai: Janpai): number;
    calledCount(janpai: Janpai): number;
    count(janpai: Janpai): number;
    discard(janpai: Janpai): Janpai | undefined;
    fix(fixed: Mentsu): void;
    includes(janpai: Janpai): boolean;
    kongableList(tsumo: Janpai): Janpai[];
    pop(): Janpai | undefined;
    push(janpai: Janpai): void;
    remove(janpai: Janpai, count?: number): void;
    toObject(): HandObject;
    updateWaitTable(): void;
    get allJanpaiList(): Janpai[];
    get callCount(): number;
    get calledJanpaiList(): Janpai[];
    get completableList(): Janpai[];
    get calledList(): Mentsu[];
    get fixedList(): Mentsu[];
    get janpaiList(): Janpai[];
    get waitTable(): WaitTable;
    _chowableList(): Janpai[];
    _kongable(tsumo: Janpai, janpai: Janpai): boolean;
    _lightKongableList(): Janpai[];
    _pungableList(): Janpai[];
}
//# sourceMappingURL=hand.d.ts.map
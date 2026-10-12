import { Janpai } from "./janpai";
import { Mentsu } from "./mentsu";
export declare class CompletePattern {
    private _mentsuList;
    private _head;
    constructor(_mentsuList: Mentsu[], _head: Janpai);
    get chowList(): Mentsu[];
    get concealedPungCount(): number;
    get darkKongCount(): number;
    get dragonCount(): number;
    get head(): Janpai;
    get hasJi(): boolean;
    get jiAll(): boolean;
    get knittedChowList(): Mentsu[];
    get kongCount(): number;
    get kongList(): Mentsu[];
    get mentsuList(): Mentsu[];
    get pungList(): Mentsu[];
    get windCount(): number;
    get yaoAll(): boolean;
}
//# sourceMappingURL=complete-pattern.d.ts.map
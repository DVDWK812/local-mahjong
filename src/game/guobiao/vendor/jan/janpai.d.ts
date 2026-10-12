import { JanpaiID } from './janpai-id';
export type JanpaiObject = {
    id: JanpaiID;
    red: boolean;
};
export declare class Janpai {
    private _id;
    private _red;
    constructor(_id: JanpaiID, _red?: boolean);
    clone(): Janpai;
    equals(target: Janpai): boolean;
    toObject(): JanpaiObject;
    toString(): string;
    get dragon(): boolean;
    get even(): boolean;
    get five(): boolean;
    get id(): JanpaiID;
    get ji(): boolean;
    get next(): Janpai;
    get number(): number;
    get prev(): Janpai;
    get red(): boolean;
    get suit(): "MAN" | "PIN" | "SOU" | "JI";
    get yao(): boolean;
    get wind(): boolean;
}
//# sourceMappingURL=janpai.d.ts.map
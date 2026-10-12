import { CompleteType } from './complete-type';
import { Janpai } from './janpai';
import { Wind } from './wind';
export declare class CompleteInfo {
    private _janpai;
    private _last;
    private _prevalent;
    private _seat;
    private _type;
    constructor(_janpai: Janpai, _last?: boolean, _prevalent?: Wind, _seat?: Wind, _type?: CompleteType);
    get janpai(): Janpai;
    get last(): boolean;
    get prevalent(): Wind;
    get seat(): Wind;
    get type(): CompleteType;
}
//# sourceMappingURL=complete-info.d.ts.map
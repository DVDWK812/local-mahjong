import { McrYaku } from './mcr-yaku';
export type McrCompleteObject = {
    yakuList: McrYaku[];
};
export declare class McrComplete {
    private _yakuList;
    private _point;
    constructor(_yakuList: McrYaku[]);
    toObject(): McrCompleteObject;
    get point(): number;
    get yakuList(): McrYaku[];
    private _totalPoint;
}
//# sourceMappingURL=mcr-complete.d.ts.map
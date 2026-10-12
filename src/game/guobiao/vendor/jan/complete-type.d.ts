export declare const COMPLETE_TYPE: {
    readonly FINAL_DRAW_AND_WIN_ON_KONG: {
        readonly tsumo: true;
        readonly name: "妙手回春、槓上開花";
    };
    readonly FINAL_DRAW: {
        readonly tsumo: true;
        readonly name: "妙手回春";
    };
    readonly FINAL_DISCARD: {
        readonly tsumo: false;
        readonly name: "海底撈月";
    };
    readonly WIN_ON_KONG: {
        readonly tsumo: true;
        readonly name: "槓上開花";
    };
    readonly ROBBING_A_KONG: {
        readonly tsumo: false;
        readonly name: "搶槓";
    };
    readonly DRAW: {
        readonly tsumo: true;
        readonly name: "ツモ";
    };
    readonly DISCARD: {
        readonly tsumo: false;
        readonly name: "ロン";
    };
};
export type CompleteType = typeof COMPLETE_TYPE[keyof typeof COMPLETE_TYPE];
//# sourceMappingURL=complete-type.d.ts.map
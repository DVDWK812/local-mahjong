import { Janpai } from './janpai';
export declare const KNITTED_STRAIGHT: {
    readonly MPS: readonly [Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai];
    readonly MSP: readonly [Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai];
    readonly PSM: readonly [Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai];
    readonly PMS: readonly [Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai];
    readonly SMP: readonly [Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai];
    readonly SPM: readonly [Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai, Janpai];
};
export type KnittedStraight = typeof KNITTED_STRAIGHT[keyof typeof KNITTED_STRAIGHT];
export type KnittedType = keyof typeof KNITTED_STRAIGHT;
export type KnittedTypes = (keyof typeof KNITTED_STRAIGHT)[];
//# sourceMappingURL=knitted-straight.d.ts.map
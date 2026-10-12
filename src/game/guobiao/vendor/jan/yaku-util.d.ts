import { Janpai } from './janpai';
import { CompletePattern } from './complete-pattern';
import { McrYaku } from './mcr-yaku';
import { Hand } from './hand';
import { CompleteInfo } from './complete-info';
import { Mentsu } from './mentsu';
export declare function allFives(completePattern: CompletePattern): boolean;
export declare function allGreen(janpaiList: Janpai[]): boolean;
export declare function allHonors(janpaiList: Janpai[]): boolean;
export declare function allSimples(janpaiList: Janpai[]): boolean;
export declare function allTerminals(janpaiList: Janpai[]): boolean;
export declare function allTerminalsAndHonors(janpaiList: Janpai[]): boolean;
export declare function allTypes(janpaiList: Janpai[]): boolean;
export declare function chickenHand(yakuList: McrYaku[]): boolean;
export declare function closedWait(completePattern: CompletePattern, janpai: Janpai): boolean;
export declare function concealedHand(hand: Hand, completeInfo: CompleteInfo): boolean;
export declare function doublePung(doublePung: Mentsu[]): boolean;
export declare function edgeWait(completePattern: CompletePattern, janpai: Janpai): boolean;
export declare function fourPureShiftedPungs(fourPungs: Mentsu[]): boolean;
export declare function fourShiftedChows(fourChows: Mentsu[]): boolean;
export declare function fullFlush(janpaiList: Janpai[]): boolean;
export declare function fullyConcealed(hand: Hand, completeInfo: CompleteInfo): boolean;
export declare function greaterHonorsAndKnittedTiles(janpaiList: Janpai[]): boolean;
export declare function halfFlush(janpaiList: Janpai[]): boolean;
export declare function honorsAndKnittedTiles(janpaiList: Janpai[]): boolean;
export declare function incidentalBonusesYakuList(completeInfo: CompleteInfo): ({
    readonly point: 10;
    readonly name: "海底撈月";
} | {
    readonly point: 10;
    readonly name: "嶺上開花";
})[] | {
    readonly point: 10;
    readonly name: "河底撈魚";
}[] | {
    readonly point: 10;
    readonly name: "搶槓";
}[];
export declare function knittedStraight(janpaiList: Janpai[]): "MPS" | "MSP" | "PSM" | "PMS" | "SMP" | "SPM" | undefined;
export declare function lastTile(completeInfo: CompleteInfo): boolean;
export declare function lowerFour(janpaiList: Janpai[]): boolean;
export declare function lowerTiles(janpaiList: Janpai[]): boolean;
export declare function meldedHand(hand: Hand, completeInfo: CompleteInfo): boolean;
export declare function middleTiles(janpaiList: Janpai[]): boolean;
export declare function mixedDoubleChow(doubleChow: Mentsu[]): boolean;
export declare function mixedShiftedChows(threeChows: Mentsu[]): boolean;
export declare function mixedShiftedPungs(threePungs: Mentsu[]): boolean;
export declare function mixedStraight(threeChows: Mentsu[]): boolean;
export declare function mixedTripleChow(tripleChow: Mentsu[]): boolean;
export declare function nineGates(janpaiList: Janpai[]): boolean;
export declare function noHonors(janpaiList: Janpai[]): boolean;
export declare function oneVoidedSuit(janpaiList: Janpai[]): boolean;
export declare function pureDoubleChow(doubleChow: Mentsu[]): boolean;
export declare function pureShiftedChows(threeChows: Mentsu[]): boolean;
export declare function pureShiftedPungs(threePungs: Mentsu[]): boolean;
export declare function pureStraight(threeChows: Mentsu[]): boolean;
export declare function pureTripleChow(tripleChow: Mentsu[]): boolean;
export declare function quadrupleChow(quadrupleChow: Mentsu[]): boolean;
export declare function reversibleTiles(janpaiList: Janpai[]): boolean;
export declare function selfDrawn(hand: Hand, completeInfo: CompleteInfo): boolean;
export declare function sevenPairs(janpaiList: Janpai[]): boolean;
export declare function sevenShiftedPairs(janpaiList: Janpai[]): boolean;
export declare function shortStraight(twoChows: Mentsu[]): boolean;
export declare function singleWait(completePattern: CompletePattern, janpai: Janpai): boolean;
export declare function terminalsYaku(completePattern: CompletePattern): {
    readonly point: 40;
    readonly name: "混全帶么";
} | {
    readonly point: 50;
    readonly name: "純全帶么";
} | {
    readonly point: 100;
    readonly name: "混么九";
} | {
    readonly point: 400;
    readonly name: "清么九";
} | undefined;
export declare function thirteenOrphans(janpaiList: Janpai[]): boolean;
export declare function tileHogCount(hand: Hand, janpai: Janpai): number;
export declare function triplePung(triplePung: Mentsu[]): boolean;
export declare function twoIdenticalSequencesTwice(quadrupleChow: Mentsu[]): boolean;
export declare function twoTerminalChows(twoChows: Mentsu[]): boolean;
export declare function upperFour(janpaiList: Janpai[]): boolean;
export declare function upperTiles(janpaiList: Janpai[]): boolean;
//# sourceMappingURL=yaku-util.d.ts.map
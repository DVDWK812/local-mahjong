import { CompletePattern } from './complete-pattern';
import { Janpai } from './janpai';
import { Mentsu } from './mentsu';
import { ZjmYaku } from './zjm-yaku';
export default class ZjmUtil {
    static _concealedTripletsYaku(completePattern: CompletePattern): {
        readonly point: 5;
        readonly name: "二暗刻";
    } | {
        readonly point: 30;
        readonly name: "三暗刻";
    } | {
        readonly point: 125;
        readonly name: "四暗刻";
    } | undefined;
    static _dragonsYaku(completePattern: CompletePattern): {
        readonly point: 40;
        readonly name: "小三元";
    } | {
        readonly point: 130;
        readonly name: "大三元";
    } | undefined;
    static _honorTilesYakuList(completePattern: CompletePattern): ZjmYaku[];
    static _kongYaku(completePattern: CompletePattern): {
        readonly point: 5;
        readonly name: "一槓";
    } | {
        readonly point: 20;
        readonly name: "二槓";
    } | {
        readonly point: 120;
        readonly name: "三槓";
    } | {
        readonly point: 480;
        readonly name: "四槓";
    } | undefined;
    static _mentsuYakuList(completePattern: CompletePattern): ZjmYaku[];
    static _prevNumberMentsuYaku(callBack: (mentsuList: Mentsu[], ...janpai: Janpai[]) => ZjmYaku | undefined, mentsuList: Mentsu[], head: Janpai | undefined): ZjmYaku | undefined;
    static _push(yakuList: ZjmYaku[], yaku: ZjmYaku | undefined): void;
    static _smallThreeSimilarTriplets(twoPungs: Mentsu[], head: Janpai): {
        readonly point: 30;
        readonly name: "三色小同刻";
    } | undefined;
    static _threeChowsYaku(threeChows: Mentsu[]): {
        readonly point: 120;
        readonly name: "一色三同順";
    } | {
        readonly point: 35;
        readonly name: "三色同順";
    } | {
        readonly point: 40;
        readonly name: "一氣通貫";
    } | undefined;
    static _threePungsYaku(threePungs: Mentsu[]): {
        readonly point: 30;
        readonly name: "三暗刻";
    } | {
        readonly point: 120;
        readonly name: "三色同刻";
    } | undefined;
    static _tripletsAndKongYakuList(completePattern: CompletePattern): {
        readonly point: 30;
        readonly name: "對對和";
    }[];
    static _twoIndenticalSequences(twoChows: Mentsu[]): {
        readonly point: 10;
        readonly name: "一般高";
    } | undefined;
    static _twoMentsuYakuWithFourMentsu(callBack: (mentsuList: Mentsu[], ...head: Janpai[]) => ZjmYaku | undefined, fourMentsu: Mentsu[], head: Janpai | undefined): ZjmYaku | undefined;
    static _windsYaku(completePattern: CompletePattern): {
        readonly point: 30;
        readonly name: "小三風";
    } | {
        readonly point: 120;
        readonly name: "大三風";
    } | {
        readonly point: 320;
        readonly name: "小四喜";
    } | {
        readonly point: 400;
        readonly name: "大四喜";
    } | undefined;
    static _yakuWithFourChows(fourChows: Mentsu[]): ZjmYaku | undefined;
    static _yakuWithFourPungs(fourPungs: Mentsu[], head: Janpai): ZjmYaku | undefined;
    static _yakuWithThreeChows(threeChows: Mentsu[]): ZjmYaku | undefined;
    static _yakuWithThreePungs(threePungs: Mentsu[], head: Janpai): ZjmYaku | undefined;
}
//# sourceMappingURL=zjm-util.d.ts.map
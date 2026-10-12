import { CompleteInfo } from './complete-info';
import { CompletePattern } from './complete-pattern';
import { Hand } from './hand';
import { Janpai } from './janpai';
import { McrComplete } from './mcr-complete';
import { McrYaku } from './mcr-yaku';
import { Mentsu } from './mentsu';
export default class McrUtil {
    static complete(hand: Hand, completeInfo: CompleteInfo): McrComplete;
    static _allChows(completePattern: CompletePattern): boolean;
    static _allInvolvedYaku(completePattern: CompletePattern): {
        readonly point: 16;
        readonly englishName: "All Fives";
        readonly name: "全帯五";
    } | {
        readonly point: 4;
        readonly englishName: "Outside Hand";
        readonly name: "全帯幺";
    } | undefined;
    static _allEvenPungs(completePattern: CompletePattern): boolean;
    static _beingWholeYakuList(hand: Hand, completeInfo: CompleteInfo): McrYaku[];
    static _brokenYakuList(janpaiList: Janpai[]): McrYaku[];
    static _concealedPungsAndKongsYakuList(completePattern: CompletePattern): McrYaku[];
    static _concealedPungsYaku(completePattern: CompletePattern): {
        readonly point: 64;
        readonly englishName: "Four Concealed Pungs";
        readonly name: "四暗刻";
    } | {
        readonly point: 16;
        readonly englishName: "Three Concealed Pungs";
        readonly name: "三暗刻";
    } | {
        readonly point: 2;
        readonly englishName: "Two Concealed Pungs";
        readonly name: "双暗刻";
    } | undefined;
    static _dragonsYaku(completePattern: CompletePattern): {
        readonly point: 88;
        readonly englishName: "Big Three Dragons";
        readonly name: "大三元";
    } | {
        readonly point: 64;
        readonly englishName: "Little Three Dragons";
        readonly name: "小三元";
    } | {
        readonly point: 6;
        readonly englishName: "Two Dragon Pungs";
        readonly name: "双箭刻";
    } | {
        readonly point: 2;
        readonly englishName: "Dragon Pung";
        readonly name: "箭刻";
    } | undefined;
    static _fullChowsYakuList(hand: Hand, janpai: Janpai): {
        readonly point: 88;
        readonly englishName: "Nine Gates";
        readonly name: "九蓮宝燈";
    }[] | ({
        readonly point: 88;
        readonly englishName: "All Green";
        readonly name: "緑一色";
    } | {
        readonly point: 24;
        readonly englishName: "Full Flush";
        readonly name: "清一色";
    } | {
        readonly point: 6;
        readonly englishName: "Half Flush";
        readonly name: "混一色";
    } | {
        readonly point: 6;
        readonly englishName: "All Types";
        readonly name: "五門斉";
    } | {
        readonly point: 1;
        readonly englishName: "One Voided Suit";
        readonly name: "缺一門";
    } | {
        readonly point: 1;
        readonly englishName: "No Honors";
        readonly name: "無字";
    })[];
    static _higherYakuList(yakuList: McrYaku[], newYakuList: McrYaku[]): McrYaku[];
    static _honorTilesYakuList(completePattern: CompletePattern, completeInfo: CompleteInfo): ({
        readonly point: 88;
        readonly englishName: "Big Four Winds";
        readonly name: "大四喜";
    } | {
        readonly point: 64;
        readonly englishName: "Little Four Winds";
        readonly name: "小四喜";
    } | {
        readonly point: 12;
        readonly englishName: "Big Three Winds";
        readonly name: "三風刻";
    })[];
    static _kongsYakuList(completePattern: CompletePattern): ({
        readonly point: 88;
        readonly englishName: "Four Kongs";
        readonly name: "四槓";
    } | {
        readonly point: 2;
        readonly englishName: "Concealed Kong";
        readonly name: "暗槓";
    })[] | {
        readonly point: 32;
        readonly englishName: "Three Kongs";
        readonly name: "三槓";
    }[] | {
        readonly point: 8;
        readonly englishName: "Two Concealed Kongs";
        readonly name: "双暗槓";
    }[] | ({
        readonly point: 4;
        readonly englishName: "Two Melded Kongs";
        readonly name: "双明槓";
    } | {
        readonly point: 2;
        readonly englishName: "Concealed Kong";
        readonly name: "暗槓";
    })[] | {
        readonly point: 1;
        readonly englishName: "Melded Kong";
        readonly name: "明槓";
    }[];
    static _limitedNumberYakuList(janpaiList: Janpai[]): ({
        readonly point: 24;
        readonly englishName: "Upper Tiles";
        readonly name: "全大";
    } | {
        readonly point: 24;
        readonly englishName: "Middle Tiles";
        readonly name: "全中";
    } | {
        readonly point: 24;
        readonly englishName: "Lower Tiles";
        readonly name: "全小";
    } | {
        readonly point: 12;
        readonly englishName: "Upper Four";
        readonly name: "大于五";
    } | {
        readonly point: 12;
        readonly englishName: "Lower Four";
        readonly name: "小于五";
    } | {
        readonly point: 2;
        readonly englishName: "All Simples";
        readonly name: "断幺";
    })[];
    static _mentsuYakuList(hand: Hand, completeInfo: CompleteInfo): McrYaku[];
    static _numberTilesYakuList(completePattern: CompletePattern): ({
        readonly point: 88;
        readonly englishName: "Big Four Winds";
        readonly name: "大四喜";
    } | {
        readonly point: 88;
        readonly englishName: "Big Three Dragons";
        readonly name: "大三元";
    } | {
        readonly point: 88;
        readonly englishName: "All Green";
        readonly name: "緑一色";
    } | {
        readonly point: 88;
        readonly englishName: "Nine Gates";
        readonly name: "九蓮宝燈";
    } | {
        readonly point: 88;
        readonly englishName: "Four Kongs";
        readonly name: "四槓";
    } | {
        readonly point: 88;
        readonly englishName: "Seven Shifted Pairs";
        readonly name: "連七対";
    } | {
        readonly point: 88;
        readonly englishName: "Thirteen Orphans";
        readonly name: "十三幺";
    } | {
        readonly point: 64;
        readonly englishName: "All Terminals";
        readonly name: "清幺九";
    } | {
        readonly point: 64;
        readonly englishName: "Little Four Winds";
        readonly name: "小四喜";
    } | {
        readonly point: 64;
        readonly englishName: "Little Three Dragons";
        readonly name: "小三元";
    } | {
        readonly point: 64;
        readonly englishName: "All Honors";
        readonly name: "字一色";
    } | {
        readonly point: 64;
        readonly englishName: "Four Concealed Pungs";
        readonly name: "四暗刻";
    } | {
        readonly point: 64;
        readonly englishName: "Pure Terminal Chows";
        readonly name: "一色双龍会";
    } | {
        readonly point: 48;
        readonly englishName: "Quadruple Chow";
        readonly name: "一色四同順";
    } | {
        readonly point: 48;
        readonly englishName: "Four Pure Shifted Pungs";
        readonly name: "一色四節高";
    } | {
        readonly point: 32;
        readonly englishName: "Four Pure Shifted Chows";
        readonly name: "一色四歩高";
    } | {
        readonly point: 32;
        readonly englishName: "Three Kongs";
        readonly name: "三槓";
    } | {
        readonly point: 32;
        readonly englishName: "All Terminals and Honors";
        readonly name: "混幺九";
    } | {
        readonly point: 24;
        readonly englishName: "Seven Pairs";
        readonly name: "七対";
    } | {
        readonly point: 24;
        readonly englishName: "Greater Honors and Knitted Tiles";
        readonly name: "七星不靠";
    } | {
        readonly point: 24;
        readonly englishName: "All Even Pungs";
        readonly name: "全双刻";
    } | {
        readonly point: 24;
        readonly englishName: "Full Flush";
        readonly name: "清一色";
    } | {
        readonly point: 24;
        readonly englishName: "Pure Triple Chow";
        readonly name: "一色三同順";
    } | {
        readonly point: 24;
        readonly englishName: "Pure Shifted Pungs";
        readonly name: "一色三節高";
    } | {
        readonly point: 24;
        readonly englishName: "Upper Tiles";
        readonly name: "全大";
    } | {
        readonly point: 24;
        readonly englishName: "Middle Tiles";
        readonly name: "全中";
    } | {
        readonly point: 24;
        readonly englishName: "Lower Tiles";
        readonly name: "全小";
    } | {
        readonly point: 16;
        readonly englishName: "Pure Straight";
        readonly name: "清龍";
    } | {
        readonly point: 16;
        readonly englishName: "Three-Suited Terminal Chows";
        readonly name: "三色双龍会";
    } | {
        readonly point: 16;
        readonly englishName: "Pure Shifted Chows";
        readonly name: "一色三歩高";
    } | {
        readonly point: 16;
        readonly englishName: "All Fives";
        readonly name: "全帯五";
    } | {
        readonly point: 16;
        readonly englishName: "Triple Pung";
        readonly name: "三同刻";
    } | {
        readonly point: 16;
        readonly englishName: "Three Concealed Pungs";
        readonly name: "三暗刻";
    } | {
        readonly point: 12;
        readonly englishName: "Lesser Honors and Knitted Tiles";
        readonly name: "全不靠";
    } | {
        readonly point: 12;
        readonly englishName: "Knitted Straight";
        readonly name: "組合龍";
    } | {
        readonly point: 12;
        readonly englishName: "Upper Four";
        readonly name: "大于五";
    } | {
        readonly point: 12;
        readonly englishName: "Lower Four";
        readonly name: "小于五";
    } | {
        readonly point: 12;
        readonly englishName: "Big Three Winds";
        readonly name: "三風刻";
    } | {
        readonly point: 8;
        readonly englishName: "Mixed Straight";
        readonly name: "花龍";
    } | {
        readonly point: 8;
        readonly englishName: "Reversible Tiles";
        readonly name: "推不倒";
    } | {
        readonly point: 8;
        readonly englishName: "Mixed Triple Chow";
        readonly name: "三色三同順";
    } | {
        readonly point: 8;
        readonly englishName: "Mixed Shifted Pungs";
        readonly name: "三色三節高";
    } | {
        readonly point: 8;
        readonly englishName: "Chicken Hand";
        readonly name: "無番和";
    } | {
        readonly point: 8;
        readonly englishName: "Last Tile Draw";
        readonly name: "妙手回春";
    } | {
        readonly point: 8;
        readonly englishName: "Last Tile Claim";
        readonly name: "海底撈月";
    } | {
        readonly point: 8;
        readonly englishName: "Out with Replacement Tile";
        readonly name: "槓上開花";
    } | {
        readonly point: 8;
        readonly englishName: "Robbing the Kong";
        readonly name: "搶槓和";
    } | {
        readonly point: 8;
        readonly englishName: "Two Concealed Kongs";
        readonly name: "双暗槓";
    } | {
        readonly point: 6;
        readonly englishName: "All Pungs";
        readonly name: "碰碰和";
    } | {
        readonly point: 6;
        readonly englishName: "Half Flush";
        readonly name: "混一色";
    } | {
        readonly point: 6;
        readonly englishName: "Mixed Shifted Chows";
        readonly name: "三色三歩高";
    } | {
        readonly point: 6;
        readonly englishName: "All Types";
        readonly name: "五門斉";
    } | {
        readonly point: 6;
        readonly englishName: "Melded Hand";
        readonly name: "全求人";
    } | {
        readonly point: 6;
        readonly englishName: "Two Dragon Pungs";
        readonly name: "双箭刻";
    } | {
        readonly point: 4;
        readonly englishName: "Outside Hand";
        readonly name: "全帯幺";
    } | {
        readonly point: 4;
        readonly englishName: "Fully Cncealed Hand";
        readonly name: "不求人";
    } | {
        readonly point: 4;
        readonly englishName: "Two Melded Kongs";
        readonly name: "双明槓";
    } | {
        readonly point: 4;
        readonly englishName: "Last Tile";
        readonly name: "和絶張";
    } | {
        readonly point: 2;
        readonly englishName: "Dragon Pung";
        readonly name: "箭刻";
    } | {
        readonly point: 2;
        readonly englishName: "Prevalent Wind";
        readonly name: "圈風刻";
    } | {
        readonly point: 2;
        readonly englishName: "Seat Wind";
        readonly name: "門風刻";
    } | {
        readonly point: 2;
        readonly englishName: "Concealed Hand";
        readonly name: "門前清";
    } | {
        readonly point: 2;
        readonly englishName: "All Chows";
        readonly name: "平和";
    } | {
        readonly point: 2;
        readonly englishName: "Tile Hog";
        readonly name: "四帰一";
    } | {
        readonly point: 2;
        readonly englishName: "Double Pung";
        readonly name: "双同刻";
    } | {
        readonly point: 2;
        readonly englishName: "Two Concealed Pungs";
        readonly name: "双暗刻";
    } | {
        readonly point: 2;
        readonly englishName: "Concealed Kong";
        readonly name: "暗槓";
    } | {
        readonly point: 2;
        readonly englishName: "All Simples";
        readonly name: "断幺";
    } | {
        readonly point: 1;
        readonly englishName: "Pure Double Chow";
        readonly name: "一般高";
    } | {
        readonly point: 1;
        readonly englishName: "Mixed Double Chow";
        readonly name: "喜相逢";
    } | {
        readonly point: 1;
        readonly englishName: "Short Straight";
        readonly name: "連六";
    } | {
        readonly point: 1;
        readonly englishName: "Two Terminal Chows";
        readonly name: "老少副";
    } | {
        readonly point: 1;
        readonly englishName: "Pung of Terminals or Honors";
        readonly name: "幺九刻";
    } | {
        readonly point: 1;
        readonly englishName: "Melded Kong";
        readonly name: "明槓";
    } | {
        readonly point: 1;
        readonly englishName: "One Voided Suit";
        readonly name: "缺一門";
    } | {
        readonly point: 1;
        readonly englishName: "No Honors";
        readonly name: "無字";
    } | {
        readonly point: 1;
        readonly englishName: "Edge Wait";
        readonly name: "辺張";
    } | {
        readonly point: 1;
        readonly englishName: "Closed Wait";
        readonly name: "坎張";
    } | {
        readonly point: 1;
        readonly englishName: "Single Wait";
        readonly name: "単調将";
    } | {
        readonly point: 1;
        readonly englishName: "Self-drawn";
        readonly name: "自摸";
    } | {
        readonly point: 1;
        readonly englishName: "Flower Tiles";
        readonly name: "花牌";
    })[];
    static _pungsOfTerminalsOrHonors(completePattern: CompletePattern): {
        readonly point: 1;
        readonly englishName: "Pung of Terminals or Honors";
        readonly name: "幺九刻";
    }[];
    static _pungsYakuList(completePattern: CompletePattern): McrYaku[];
    static _pureTerminalChows(fourChows: Mentsu[], head: Janpai): boolean;
    static _push(yakuList: McrYaku[], yaku: McrYaku | undefined): void;
    static _removeExcludeYaku(yakuList: McrYaku[], completeInfo: CompleteInfo): McrYaku[];
    static _removeExcludeYakuWithCombined(yakuList: McrYaku[]): McrYaku[];
    static _removePureDoubleChow(chowList: Mentsu[]): boolean;
    static _removeWaitYaku(yakuList: McrYaku[], knittedChowList: Mentsu[], janpai: Janpai): void;
    static _removeYaku(yakuList: McrYaku[], yaku: McrYaku): void;
    static _sevenPairsYaku(janpaiList: Janpai[]): {
        readonly point: 88;
        readonly englishName: "Seven Shifted Pairs";
        readonly name: "連七対";
    } | {
        readonly point: 24;
        readonly englishName: "Seven Pairs";
        readonly name: "七対";
    };
    static _specialYakuList(yakuList: McrYaku[], hand: Hand, janpai: Janpai): void;
    static _terminalsOrHonorsYaku(janpaiList: Janpai[]): {
        readonly point: 64;
        readonly englishName: "All Terminals";
        readonly name: "清幺九";
    } | {
        readonly point: 32;
        readonly englishName: "All Terminals and Honors";
        readonly name: "混幺九";
    } | undefined;
    static _threeChowsYaku(threeChows: Mentsu[]): {
        readonly point: 24;
        readonly englishName: "Pure Triple Chow";
        readonly name: "一色三同順";
    } | {
        readonly point: 16;
        readonly englishName: "Pure Straight";
        readonly name: "清龍";
    } | {
        readonly point: 16;
        readonly englishName: "Pure Shifted Chows";
        readonly name: "一色三歩高";
    } | {
        readonly point: 8;
        readonly englishName: "Mixed Straight";
        readonly name: "花龍";
    } | {
        readonly point: 8;
        readonly englishName: "Mixed Triple Chow";
        readonly name: "三色三同順";
    } | {
        readonly point: 6;
        readonly englishName: "Mixed Shifted Chows";
        readonly name: "三色三歩高";
    } | undefined;
    static _threeMentsuYakuListWithFourMentsu(fourMentsu: Mentsu[], chow?: boolean): McrYaku[];
    static _threePungsYaku(threePungs: Mentsu[]): {
        readonly point: 24;
        readonly englishName: "Pure Shifted Pungs";
        readonly name: "一色三節高";
    } | {
        readonly point: 16;
        readonly englishName: "Triple Pung";
        readonly name: "三同刻";
    } | {
        readonly point: 8;
        readonly englishName: "Mixed Shifted Pungs";
        readonly name: "三色三節高";
    } | undefined;
    static _threeSuitedTerminalChows(fourChows: Mentsu[], head: Janpai): boolean;
    static _twoChowsYaku(twoChows: Mentsu[]): {
        readonly point: 1;
        readonly englishName: "Pure Double Chow";
        readonly name: "一般高";
    } | {
        readonly point: 1;
        readonly englishName: "Mixed Double Chow";
        readonly name: "喜相逢";
    } | {
        readonly point: 1;
        readonly englishName: "Short Straight";
        readonly name: "連六";
    } | {
        readonly point: 1;
        readonly englishName: "Two Terminal Chows";
        readonly name: "老少副";
    } | undefined;
    static _twoMentsuYakuList(mentsuList: Mentsu[], max: number, chow?: boolean): McrYaku[];
    static _twoPungsYaku(twoPungs: Mentsu[]): {
        readonly point: 2;
        readonly englishName: "Double Pung";
        readonly name: "双同刻";
    } | undefined;
    static _waitYaku(completePattern: CompletePattern, janpai: Janpai, completableList: Janpai[]): {
        readonly point: 1;
        readonly englishName: "Edge Wait";
        readonly name: "辺張";
    } | {
        readonly point: 1;
        readonly englishName: "Closed Wait";
        readonly name: "坎張";
    } | {
        readonly point: 1;
        readonly englishName: "Single Wait";
        readonly name: "単調将";
    } | undefined;
    static _windsYakuList(completePattern: CompletePattern, completeInfo: CompleteInfo): {
        readonly point: 88;
        readonly englishName: "Big Four Winds";
        readonly name: "大四喜";
    }[] | ({
        readonly point: 64;
        readonly englishName: "Little Four Winds";
        readonly name: "小四喜";
    } | {
        readonly point: 12;
        readonly englishName: "Big Three Winds";
        readonly name: "三風刻";
    })[];
    static _yakuListWithFourChows(fourChows: Mentsu[], head: Janpai): McrYaku[];
    static _yakuListWithFourPungs(fourPungs: Mentsu[]): McrYaku[];
    static _yakuListWithThreeChows(threeChows: Mentsu[]): McrYaku[];
    static _yakuListWithThreePungs(threePungs: Mentsu[]): McrYaku[];
}
//# sourceMappingURL=mcr-util.d.ts.map
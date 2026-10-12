import { Janpai, JanpaiObject } from './janpai';
import { MentsuType } from './mentsu-type';
export type MentsuObject = {
    dark: boolean;
    janpaiObjectList: JanpaiObject[];
    type: MentsuType;
};
export declare class Mentsu {
    private _type;
    private _janpaiList;
    private _dark;
    constructor(_type: MentsuType, _janpaiList: Janpai[], _dark?: boolean);
    static createChowMentsu(head: Janpai, dark?: boolean): Mentsu;
    static createKnittedChowMentsu(head: Janpai): Mentsu;
    static createKongMentsu(janpai: Janpai, dark?: boolean): Mentsu;
    static createPungMentsu(janpai: Janpai, dark?: boolean): Mentsu;
    isKongableTo(janpai: Janpai): boolean;
    pungToKong(janpai: Janpai): void;
    toObject(): MentsuObject;
    get chow(): boolean;
    get concealedChow(): boolean;
    get dark(): boolean;
    get five(): boolean;
    get hasJi(): boolean;
    get hasYao(): boolean;
    get head(): Janpai;
    get janpaiList(): Janpai[];
    get knittedChow(): boolean;
    get kong(): boolean;
    get middle(): Janpai;
    get pung(): boolean;
    get suit(): "MAN" | "PIN" | "SOU" | "JI";
}
//# sourceMappingURL=mentsu.d.ts.map
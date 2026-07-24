import type { Tile, TileId, Wind } from '../../types';
import type { RuleConfig } from '../rules/RuleConfig';
import type { YakuResult } from '../yaku/types';
import type { WaitType, WinType } from '../scoringTypes';

export type { WaitType, WinType } from '../scoringTypes';

export interface FuMeld {
  type: 'sequence' | 'triplet' | 'kan';
  ids: TileId[];
  open: boolean;
  kanType?: 'ankan' | 'minkan' | 'kakan';
}

export interface FuContext {
  hand: Tile[];
  winningTile: Tile;
  melds: FuMeld[];
  pair: TileId | null;
  waitType: WaitType;
  winType: WinType;
  isMenzen: boolean;
  isTsumo: boolean;
  isRon: boolean;
  seatWind: Wind;
  roundWind: Wind;
  yakuList: YakuResult[];
  ruleConfig?: Partial<RuleConfig>;
}

import type { PlayerId, Tile, TileId, Wind } from '../types';
import type { RuleConfig } from './rules/RuleConfig';

export type WaitType = 'ryanmen' | 'kanchan' | 'penchan' | 'tanki' | 'shanpon';
export type WinType = 'tsumo' | 'ron';
export type WinningTileSource = 'initial-hand' | 'normal-draw' | 'discard' | 'rinshan' | 'kakan';

export interface ScoringMeld {
  type: 'sequence' | 'triplet' | 'kan';
  tiles: Tile[];
  ids: TileId[];
  open: boolean;
  kanType?: 'ankan' | 'minkan' | 'kakan';
  calledTile?: Tile;
  calledFrom?: PlayerId;
}

export interface ScoringWinContext {
  winType: WinType;
  winningTile: Tile;
  winningTileSource: WinningTileSource;
  seatWind: Wind;
  roundWind: Wind;
  isMenzen: boolean;
  isRiichi: boolean;
  isDoubleRiichi: boolean;
  isIppatsu: boolean;
  isFirstTurn: boolean;
  callsOccurred: boolean;
  isLastTile: boolean;
  isHaitei?: boolean;
  isHoutei?: boolean;
  isRinshan?: boolean;
  isChankan?: boolean;
  isTenhou?: boolean;
  isChiihou?: boolean;
  waitType?: WaitType;
  melds: ScoringMeld[];
  preWinHand?: Tile[];
  ruleConfig?: Partial<RuleConfig>;
}

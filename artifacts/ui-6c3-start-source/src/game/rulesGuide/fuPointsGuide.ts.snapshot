import { calculateFuDetails, type FuBreakdown, type FuContext } from '../score/fu/fuCalculator';
import { calculatePoints, type PointResult } from '../score/pointCalculator';
import type { WinContext } from '../score/yakuChecker';
import type { FullRuleConfig } from '../match/types';
import type { Tile, TileId } from '../types';
import { getTileRank, getTileSuit } from '../tileUtils';

export interface FuExample {
  title: string;
  handIds: TileId[];
  winningTile: TileId;
  breakdown: FuBreakdown;
}

export interface PointTableRow {
  label: string;
  han: number;
  fu: number;
  childRon: PointResult;
  dealerRon: PointResult;
  childTsumo: PointResult;
  dealerTsumo: PointResult;
}

function tile(id: TileId, copyIndex: number): Tile {
  return {
    id,
    suit: getTileSuit(id),
    rank: getTileRank(id),
    red: false,
    instanceId: `guide-fu-${id}-${copyIndex}`,
  };
}

function tiles(ids: TileId[]): Tile[] {
  return ids.map((id, index) => tile(id, index));
}

export function buildFuExamples(config: FullRuleConfig): FuExample[] {
  const ruleConfig = config.round;
  const examples: Array<{ title: string; handIds: TileId[]; winningTile: TileId; context: FuContext }> = [
    {
      title: '门前荣和：基础20符 + 门前荣和10符 + 单骑2符',
      handIds: [1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14],
      winningTile: 14,
      context: {
        hand: tiles([1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14]),
        winningTile: tile(14, 4),
        melds: [
          { type: 'sequence', ids: [1, 2, 3], open: false },
          { type: 'sequence', ids: [10, 11, 12], open: false },
          { type: 'sequence', ids: [19, 20, 21], open: false },
          { type: 'sequence', ids: [4, 5, 6], open: false },
        ],
        pair: 14,
        waitType: 'tanki',
        winType: 'ron',
        isMenzen: true,
        isTsumo: false,
        isRon: true,
        seatWind: 'south',
        roundWind: 'east',
        yakuList: [],
        ruleConfig,
      },
    },
    {
      title: '平和自摸：项目规则固定20符',
      handIds: [1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14],
      winningTile: 6,
      context: {
        hand: tiles([1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14]),
        winningTile: tile(6, 4),
        melds: [
          { type: 'sequence', ids: [1, 2, 3], open: false },
          { type: 'sequence', ids: [10, 11, 12], open: false },
          { type: 'sequence', ids: [19, 20, 21], open: false },
          { type: 'sequence', ids: [4, 5, 6], open: false },
        ],
        pair: 14,
        waitType: 'ryanmen',
        winType: 'tsumo',
        isMenzen: true,
        isTsumo: true,
        isRon: false,
        seatWind: 'south',
        roundWind: 'east',
        yakuList: [],
        ruleConfig,
      },
    },
    {
      title: '役牌与暗刻：基础20符 + 自摸2符 + 役牌雀头2符 + 幺九暗刻8符',
      handIds: [0, 0, 0, 9, 10, 11, 18, 19, 20, 4, 5, 6, 31, 31],
      winningTile: 31,
      context: {
        hand: tiles([0, 0, 0, 9, 10, 11, 18, 19, 20, 4, 5, 6, 31, 31]),
        winningTile: tile(31, 4),
        melds: [
          { type: 'triplet', ids: [0, 0, 0], open: false },
          { type: 'sequence', ids: [9, 10, 11], open: false },
          { type: 'sequence', ids: [18, 19, 20], open: false },
          { type: 'sequence', ids: [4, 5, 6], open: false },
        ],
        pair: 31,
        waitType: 'tanki',
        winType: 'tsumo',
        isMenzen: true,
        isTsumo: true,
        isRon: false,
        seatWind: 'south',
        roundWind: 'east',
        yakuList: [],
        ruleConfig,
      },
    },
  ];
  return examples.map((item) => ({ ...item, breakdown: calculateFuDetails(item.context) }));
}

function pointContext(config: FullRuleConfig, seatWind: WinContext['seatWind'], isTsumo: boolean): WinContext {
  const winTile = tile(14, 0);
  return {
    winTile,
    winningTile: winTile,
    winType: isTsumo ? 'tsumo' : 'ron',
    isTsumo,
    isRiichi: false,
    isIppatsu: false,
    isMenzen: true,
    roundWind: 'east',
    seatWind,
    doraIndicators: [],
    uraDoraIndicators: [],
    honba: 0,
    riichiSticks: 0,
    ruleConfig: config.round,
  };
}

export function buildPointTable(config: FullRuleConfig): PointTableRow[] {
  return [
    { label: '1番30符', han: 1, fu: 30 },
    { label: '2番40符', han: 2, fu: 40 },
    { label: '3番40符', han: 3, fu: 40 },
    { label: '4番30符', han: 4, fu: 30 },
    { label: '满贯', han: 5, fu: 30 },
    { label: '跳满', han: 6, fu: 30 },
    { label: '倍满', han: 8, fu: 30 },
    { label: '三倍满', han: 11, fu: 30 },
    { label: '累计役满候选', han: 13, fu: 30 },
  ].map((row) => ({
    ...row,
    childRon: calculatePoints(row.han, row.fu, pointContext(config, 'south', false)),
    dealerRon: calculatePoints(row.han, row.fu, pointContext(config, 'east', false)),
    childTsumo: calculatePoints(row.han, row.fu, pointContext(config, 'south', true)),
    dealerTsumo: calculatePoints(row.han, row.fu, pointContext(config, 'east', true)),
  }));
}

import type { Tile, TileId, PlayerId } from '../types';
import type { GbConfig } from './config';
export const GB_SEATS = [0, 1, 2, 3] as const;
export const FLOWER_IDS = ['spring', 'summer', 'autumn', 'winter', 'plum', 'orchid', 'bamboo', 'chrysanthemum'] as const;
export type FlowerId = typeof FLOWER_IDS[number];
export interface FlowerTile { kind: 'flower'; flower: FlowerId; instanceId: string }
export type GbTile = (Tile & { kind: 'regular' }) | FlowerTile;
export type GbDrawSource = 'initial' | 'live' | 'flower' | 'kong';
export interface GbMeld { kind: 'chi' | 'pon' | 'minkan' | 'ankan' | 'kakan'; tiles: number[]; from: PlayerId; called: number | null }
export interface GbPlayer { participantId: string; id: PlayerId; name: string; score: number; hand: number[]; drawn: number | null;
  source: GbDrawSource | null; flowers: number[]; melds: GbMeld[]; river: { index: number; claimed: boolean; tsumogiri: boolean }[] }
export type GbAction = { type: 'discard'; tile: string } | { type: 'chi'; tiles: [string, string] }
  | { type: 'pon' | 'minkan' | 'ankan' | 'kakan'; tile: TileId } | { type: 'hu' | 'pass' | 'next' };
export interface GbResponse { id: number; from: PlayerId; tile: number; kind: 'discard' | 'kakan'; eligible: PlayerId[];
  choices: Partial<Record<PlayerId, GbAction>>; candidates: Partial<Record<PlayerId, GbAction[]>>; meldIndex?: number; lastWall: boolean }
export interface GbEvent { id: number; hand: number; type: 'deal' | 'flower' | 'draw' | 'discard' | 'chi' | 'pon' | 'kan-declared' | 'kan' | 'response' | 'settlement'; actor?: PlayerId; tile?: number; source?: GbDrawSource }
export interface GbFanItem { id: string; name: string; value: number; count: number; groups: number[] }
export interface GbScore { handShapeValid: boolean; canHu: boolean; nonFlowerFan: number; flowerFan: number; totalFan: number;
  fanItems: GbFanItem[]; excludedItems: { id: string; name: string; reason: string }[]; decomposition: GbShape | null;
  rulesVersion: string; fanTableVersion: string }
export interface GbGroup { kind: 'chi' | 'pon' | 'kan' | 'knitted'; ids: TileId[]; opened: boolean; fixed: boolean }
export interface GbShape { kind: 'ordinary' | 'seven-pairs' | 'orphans' | 'unconnected'; groups: GbGroup[]; pair?: TileId; winGroup: number }
export interface GbPayment { id: string; eventId: number; payer: string; payee: string; amount: number; reason: 'base' | 'fan' }
export interface GbResult { kind: 'win' | 'draw'; winner?: PlayerId; from?: PlayerId | null; score?: GbScore; tile?: number;
  deltas: number[]; payments: GbPayment[]; eventId: number }
export interface GbCommand { id: string; sequence: number; actor: PlayerId; action: GbAction }
export interface GbState { mode: 'guobiao'; config: GbConfig; seed: number; handNumber: number; sequence: number; turn: number;
  seats: PlayerId[]; dealer: PlayerId; current: PlayerId; phase: 'turn' | 'response' | 'ended';
  wall: { tiles: GbTile[]; order: number[]; head: number; tail: number }; players: GbPlayer[];
  events: GbEvent[]; commands: GbCommand[]; response: GbResponse | null; result: GbResult | null;
  ledger: GbPayment[]; completed: boolean; lastDrawWasLast: boolean; canSelfKong: boolean }

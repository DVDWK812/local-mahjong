import type { TileId, Wind } from '../types';
import type { ScoreResult } from '../scoreCalculator';
import type { SanmaConfig } from './config';
import type { SanmaWall } from './wall';

export type SanmaSeat = 0 | 1 | 2;
export const SANMA_SEATS: readonly SanmaSeat[] = [0, 1, 2];
export type DrawOrigin = 'initial' | 'live' | 'kan' | 'north';
export interface SanmaMeld { kind: 'pon' | 'ankan' | 'minkan' | 'kakan'; tiles: number[]; from: SanmaSeat; called: number | null }
export interface SanmaPlayer {
  id: SanmaSeat; participantId: string; name: string; score: number; hand: number[]; river: Array<{ index: number; claimed: boolean; riichi: boolean; tsumogiri: boolean }>;
  melds: SanmaMeld[]; north: number[]; drawn: number | null; drawOrigin: DrawOrigin;
  riichi: boolean; doubleRiichi: boolean; ippatsu: boolean; riichiWaits: TileId[];
  temporaryFuriten: boolean; permanentFuriten: boolean; discards: number; draws: number;
  forbiddenDiscard: TileId | null; liability: Partial<Record<'daisangen' | 'daisuushii', SanmaSeat>>;
}
export type SanmaAction = { type: 'discard' | 'riichi' | 'north' | 'ankan' | 'kakan'; tile: string }
  | { type: 'ron' | 'tsumo' | 'pass' | 'pon' | 'minkan' | 'abort' | 'next' };
export interface SanmaResponse {
  id: number; kind: 'discard' | 'north' | 'ankan' | 'kakan'; actor: SanmaSeat; tile: number;
  eligible: Partial<Record<SanmaSeat, SanmaAction[]>>; choices: Partial<Record<SanmaSeat, SanmaAction>>;
  meldIndex?: number; declarationRiichi?: boolean;
}
export interface SanmaScore extends ScoreResult { northDora: number }
export interface SanmaWin { winner: SanmaSeat; from: SanmaSeat | null; tile: number; origin: 'tsumo' | SanmaResponse['kind']; score: SanmaScore; income: number }
export interface SanmaLedgerEntry { id: number; round: number; transaction: number; from: SanmaSeat | 'pot'; to: SanmaSeat | 'pot'; amount: number; reason: 'win' | 'honba' | 'riichi' | 'sticks' | 'noten' | 'liability' | 'nagashi' }
export interface SanmaResult { kind: 'win' | 'exhaustive' | 'abort'; reason: string; winners: SanmaWin[]; tenpai: SanmaSeat[]; deltas: number[]; dealerRepeats: boolean }
export interface SanmaRanking { player: SanmaSeat; rank: number; points: number; uma: number; oka: number; result: number }
export interface SanmaRecord { sequence: number; actor: SanmaSeat; action: SanmaAction }
export interface SanmaEvent { id: number; round: number; type: 'draw' | 'discard' | 'riichi' | 'north-declared' | 'north' | 'kan-declared' | 'kan' | 'pon' | 'response' | 'settlement' | 'next'; actor: SanmaSeat; tile?: number; origin?: DrawOrigin }
export interface SanmaState {
  config: SanmaConfig; seed: number; random: number; roundSerial: number; roundWind: Wind; handNumber: number; dealer: SanmaSeat; honba: number; pot: number;
  players: SanmaPlayer[]; wall: SanmaWall; current: SanmaSeat; phase: 'turn' | 'response' | 'ended';
  turn: number; sequence: number; interrupted: boolean; kanCount: number; abortAfterDiscard: boolean;
  response: SanmaResponse | null; result: SanmaResult | null; completed: boolean; endReason: string | null; ranking: SanmaRanking[];
  ledger: SanmaLedgerEntry[]; events: SanmaEvent[]; actions: SanmaRecord[]; roundStartScores: number[];
}

import type { CallSet, PlayerId, Tile } from '../types';
import type { Pattern, XzConfig } from './config';
export type Seat = PlayerId;
export type Suit = 0 | 1 | 2;
export type Phase = 'exchange' | 'missing' | 'turn' | 'response' | 'ended';
export interface XzPlayer {
  id: Seat; participantId: string; name: string; score: number; hand: Tile[]; melds: CallSet[]; river: Tile[];
  drawn: string | null; missing: Suit | null; won: number | null; passed: number | null;
}
export interface Score { shape: 'normal' | 'sevenPairs'; patterns: { id: Pattern; name: string; fan: number }[]; fan: number; cappedFan: number; base: number; payment: number; label: string }
export interface WinContext { kind: 'draw' | 'discard' | 'rob' | 'ready'; kong?: boolean; last?: boolean; heaven?: boolean; earth?: boolean }
export interface LedgerEntry { id: string; key: string; transactionId: string; reason: 'win' | 'kong' | 'transfer' | 'refund' | 'pig' | 'ready'; from: Seat; to: Seat; amount: number; sourceAction: number; sourceKong: string | null }
export interface WinGroup { id: string; winners: Seat[]; from: Seat | null; tileId: string; kind: WinContext['kind']; scores: Score[]; action: number }
export interface Kong { id: string; player: Seat; type: 'ankan' | 'minkan' | 'kakan'; from: Seat | null; transferred: boolean }
export interface ResponseWindow { id: number; from: Seat; tile: Tile; rob: boolean; replies: Partial<Record<Seat, 'pass' | 'win' | 'pon' | 'kan'>>; eligible: Seat[]; kong: Kong | null; last: boolean; earth: boolean }
export type XzAction = { type: 'exchange'; tiles: string[] } | { type: 'exchange-draft'; tiles: string[] } | { type: 'missing'; suit: Suit } | { type: 'discard'; tile: string } | { type: 'win' } | { type: 'pass' } | { type: 'pon' } | { type: 'kan'; tile?: string } | { type: 'next' };
export interface RecordedAction { seq: number; hand: number; seat: Seat; action: XzAction }
export interface HandResult { hand: number; reason: 'three-winners' | 'wall'; scores: number[]; deltas: number[]; wins: WinGroup[]; ledger: LedgerEntry[]; classifications: string[] }
export interface XzState {
  mode: 'xuezhan'; schemaVersion: 1; config: XzConfig; seed: number; handNumber: number; dealer: Seat;
  initialWall?: Tile[];
  players: XzPlayer[]; wall: Tile[]; phase: Phase; current: Seat; turn: number; sequence: number;
  exchangeDirection: number; exchanges: Partial<Record<Seat, string[]>>; drafts: Partial<Record<Seat, string[]>>; declarations: Partial<Record<Seat, Suit>>;
  response: ResponseWindow | null; pendingKong: { seat: Seat; tile: string; meld: number } | null; lastKong: Kong | null;
  wins: WinGroup[]; ledger: LedgerEntry[]; handStartScores: number[]; results: HandResult[]; actions: RecordedAction[];
  firstDiscard: boolean; interrupted: boolean; lastDraw: boolean; completed: boolean;
}

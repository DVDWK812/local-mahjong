export type TileId =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17
  | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26
  | 27 | 28 | 29 | 30 | 31 | 32 | 33;

export type Suit = 'man' | 'pin' | 'sou' | 'honor';
export type Wind = 'east' | 'south' | 'west' | 'north';
export type SeatWind = Wind;
export type PlayerId = 0 | 1 | 2 | 3;
export type DrawSource = 'initial-hand' | 'live-wall' | 'rinshan';
export type WinSource = 'initial-hand' | 'normal-tsumo' | 'ron-discard' | 'rinshan-tsumo' | 'chankan';
export type AbortiveDrawReason = 'kyuushu-kyuuhai' | 'suufon-renda' | 'suucha-riichi' | 'suukan-sanra' | 'sanchahou';

export interface Tile {
  id: TileId;
  suit: Suit;
  rank: number;
  red: boolean;
  instanceId: string;
}

export interface CallSet {
  type: 'chi' | 'pon' | 'kan';
  tiles: Tile[];
  from: PlayerId;
  opened: boolean;
  kanType?: 'ankan' | 'minkan' | 'kakan';
  sequence?: TileId[];
  calledTile?: Tile;
  usedTileIds?: TileId[];
}

export interface ChiMeld extends CallSet {
  type: 'chi';
  sequence: TileId[];
  calledTile: Tile;
  usedTileIds: TileId[];
}

export type RiichiKind = 'none' | 'riichi' | 'double-riichi';

export interface RiichiState {
  declaredAtTurn: number;
  ippatsuAvailable: boolean;
  kind: RiichiKind;
  riichiDiscardInstanceId?: string;
}

export interface FuritenState {
  temporaryFuriten: boolean;
  riichiPermanentFuriten: boolean;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  seatWind: SeatWind;
  score: number;
  hand: Tile[];
  river: Tile[];
  calls: CallSet[];
  drawnTile: Tile | null;
  riichi: boolean;
  riichiState: RiichiState | null;
  furitenState?: FuritenState;
}

export type GamePhase =
  | 'draw'
  | 'discard'
  | 'ron-window'
  | 'call-window'
  | 'kakan-declaration'
  | 'chankan-window'
  | 'rinshan-draw'
  | 'round-ended'
  | 'exhaustive-draw';

export interface ResultYaku {
  name: string;
  han: number;
  yakuman?: boolean;
}

export interface WinResultEntry {
  winner: PlayerId;
  from: PlayerId | null;
  winType: 'tsumo' | 'ron';
  winTile: Tile;
  yaku: ResultYaku[];
  dora?: number;
  uraDora?: number;
  redDora?: number;
  han: number;
  fu: number;
  points: number;
  pointDeltas: number[];
}

export interface WinRoundResult {
  type: 'tsumo' | 'ron';
  winners: WinResultEntry[];
  pointDeltas: number[];
}

export interface AbortiveDrawResult {
  type: 'abortive-draw';
  reason: AbortiveDrawReason;
  declaredBy?: PlayerId;
  triggeringPlayer?: PlayerId;
  dealerContinues: boolean;
  honbaIncrement: number;
  riichiSticksCarryOver: boolean;
  scoreDeltas: number[];
  pointDeltas: number[];
}

export interface ExhaustiveDrawResult {
  type: 'exhaustive-draw';
  tenpaiPlayers: PlayerId[];
  notenPlayers: PlayerId[];
  scoreDeltas: number[];
  pointDeltas: number[];
  dealerContinues: boolean;
  honbaIncrement: number;
  riichiSticksCarryOver: boolean;
  nagashiManganPlayers?: PlayerId[];
  revealHands?: PlayerId[];
}

export type RoundResult = WinRoundResult | AbortiveDrawResult | ExhaustiveDrawResult;

export interface PendingCallOption {
  type: 'pon' | 'chi' | 'kan';
  player: PlayerId;
  kanType?: 'minkan';
  sequence?: TileId[];
  usedTileIds?: TileId[];
}

export interface KanState {
  type: 'ankan' | 'minkan' | 'kakan';
  player: PlayerId;
  tile: TileId;
  doraIndicatorCount: number;
}

export interface PendingCall {
  discarder: PlayerId;
  tile: Tile;
  options: PendingCallOption[];
}

export interface PendingKakan {
  declarer: PlayerId;
  ponCallIndex: number;
  addedTile: Tile;
  addedTileInstanceId: string;
  eligibleRonPlayers: PlayerId[];
  passedPlayers: PlayerId[];
}

export interface PendingRon {
  discarder: PlayerId;
  tile: Tile;
  eligibleRonPlayers: PlayerId[];
  passedPlayers: PlayerId[];
}

export interface GameState {
  roundWind: Wind;
  dealer: PlayerId;
  honba: number;
  riichiSticks: number;
  wall: Tile[];
  deadWall: Tile[];
  doraIndicators: Tile[];
  players: PlayerState[];
  currentPlayer: PlayerId;
  phase: GamePhase;
  turn: number;
  lastDiscard: {
    player: PlayerId;
    tile: Tile;
  } | null;
  result: RoundResult | null;
  pendingCall: PendingCall | null;
  pendingRon: PendingRon | null;
  pendingKakan: PendingKakan | null;
  kanState: KanState | null;
  callsOccurred: boolean;
  firstTurnInterrupted: boolean;
  playerDrawCounts: number[];
  playerDiscardCounts: number[];
  lastDrawSource: DrawSource;
  lastWinSource: WinSource | null;
  lastLiveWallDiscarder: PlayerId | null;
  pendingAbortiveDrawAfterFourthKan: boolean;
  ruleConfig?: Partial<import('./score/rules/RuleConfig').RuleConfig>;
  matchRuleConfig?: Partial<import('./match/types').MatchRuleConfig>;
}

export interface VisibleTileCount {
  id: TileId;
  visible: number;
  remaining: number;
}

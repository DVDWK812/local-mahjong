import type {
  AbortiveDrawReason,
  GameState,
  PlayerId,
  PlayerState,
  ResultYaku,
  Tile,
  WinResultEntry,
} from '../../game/types';
import { activeUraDoraIndicators } from '../../game/wall';
import { windLabel } from '../../game/tileUtils';

export interface ResultViewModelOptions {
  readonly pointDeltas?: readonly number[];
  readonly visiblePlayerIds?: readonly PlayerId[];
  readonly scoreBefore?: readonly number[];
  readonly scoreAfter?: readonly number[];
  readonly revealExhaustiveDrawPlayerIds?: readonly PlayerId[];
}

export interface PlayerScoreChangeViewModel {
  readonly playerId: PlayerId;
  readonly label: string;
  readonly delta: number;
  readonly scoreBefore?: number;
  readonly scoreAfter?: number;
}

export interface DoraResultViewModel {
  readonly available: boolean;
  readonly dora?: number;
  readonly uraDora?: number;
  readonly redDora?: number;
  readonly totalDora?: number;
}

export interface WinnerResultViewModel {
  readonly key: string;
  readonly source: WinResultEntry;
  readonly player: PlayerState;
  readonly playerLabel: string;
  readonly fromLabel: string | null;
  readonly actionLabel: '荣和' | '自摸';
  readonly concealedTiles: readonly Tile[];
  readonly winningTile: Tile;
  readonly yaku: readonly ResultYaku[];
  readonly dora: DoraResultViewModel;
  readonly han: number;
  readonly fu: number;
  readonly limitLabel: string | null;
  readonly resultPoints: number;
  readonly winnerDelta: number;
  readonly uraDoraIndicators: readonly Tile[];
}

export interface WinResultViewModel {
  readonly kind: 'win';
  readonly resultType: 'ron' | 'tsumo';
  readonly title: '荣和' | '自摸';
  readonly subtitle: string;
  readonly winners: readonly WinnerResultViewModel[];
  readonly scoreChanges: readonly PlayerScoreChangeViewModel[];
}

export interface DrawPlayerViewModel {
  readonly playerId: PlayerId;
  readonly label: string;
  readonly status: '听牌' | '未听牌';
  readonly delta: number;
  readonly revealedHand: readonly Tile[] | null;
}

export interface ExhaustiveDrawResultViewModel {
  readonly kind: 'draw';
  readonly resultType: 'draw';
  readonly title: '流局';
  readonly subtitle: '荒牌流局 · 听牌罚符结算';
  readonly players: readonly DrawPlayerViewModel[];
  readonly scoreChanges: readonly PlayerScoreChangeViewModel[];
  readonly honbaIncrement: number;
  readonly riichiSticksCarryOver: boolean;
  readonly dealerContinues: boolean;
}

export interface AbortiveDrawResultViewModel {
  readonly kind: 'abortive-draw';
  readonly resultType: 'abortive-draw';
  readonly title: '特殊流局';
  readonly reasonLabel: string;
  readonly actorLabel: string | null;
  readonly scoreChanges: readonly PlayerScoreChangeViewModel[];
  readonly honbaIncrement: number;
  readonly riichiSticksCarryOver: boolean;
  readonly dealerContinues: boolean;
}

export type ResultViewModel = WinResultViewModel | ExhaustiveDrawResultViewModel | AbortiveDrawResultViewModel;

export function buildResultViewModel(gameState: GameState, options: ResultViewModelOptions = {}): ResultViewModel | null {
  const result = gameState.result;
  if (!result) return null;
  const pointDeltas = options.pointDeltas ?? result.pointDeltas;
  const visiblePlayerIds = options.visiblePlayerIds ?? gameState.players.map((player) => player.id);
  const scoreChanges = buildScoreChanges(gameState, visiblePlayerIds, pointDeltas, options.scoreBefore, options.scoreAfter);

  if (result.type === 'ron' || result.type === 'tsumo') {
    return {
      kind: 'win',
      resultType: result.type,
      title: result.type === 'tsumo' ? '自摸' : '荣和',
      subtitle: result.winners.length > 1 ? `${result.winners.length} 人荣和` : '本局和牌结算',
      winners: result.winners.map((win) => buildWinner(gameState, win)),
      scoreChanges,
    };
  }

  if (result.type === 'exhaustive-draw') {
    const revealed = new Set([...result.tenpaiPlayers, ...(options.revealExhaustiveDrawPlayerIds ?? [])]);
    const tenpai = new Set(result.tenpaiPlayers);
    return {
      kind: 'draw',
      resultType: 'draw',
      title: '流局',
      subtitle: '荒牌流局 · 听牌罚符结算',
      players: visiblePlayerIds.map((playerId) => ({
        playerId,
        label: playerLabel(gameState.players[playerId]),
        status: tenpai.has(playerId) ? '听牌' : '未听牌',
        delta: pointDeltas[playerId] ?? 0,
        revealedHand: revealed.has(playerId) ? gameState.players[playerId].hand : null,
      })),
      scoreChanges,
      honbaIncrement: result.honbaIncrement,
      riichiSticksCarryOver: result.riichiSticksCarryOver,
      dealerContinues: result.dealerContinues,
    };
  }

  if (result.type === 'abortive-draw') {
    const actor = result.declaredBy ?? result.triggeringPlayer;
    return {
      kind: 'abortive-draw',
      resultType: 'abortive-draw',
      title: '特殊流局',
      reasonLabel: abortiveDrawReasonLabel(result.reason),
      actorLabel: actor === undefined ? null : playerLabel(gameState.players[actor]),
      scoreChanges,
      honbaIncrement: result.honbaIncrement,
      riichiSticksCarryOver: result.riichiSticksCarryOver,
      dealerContinues: result.dealerContinues,
    };
  }
  return null;
}

function buildWinner(gameState: GameState, win: WinResultEntry): WinnerResultViewModel {
  const player = gameState.players[win.winner];
  const explicitDora = win.dora !== undefined || win.uraDora !== undefined || win.redDora !== undefined || win.totalDora !== undefined;
  return {
    key: `${win.winner}-${win.winType}`,
    source: win,
    player,
    playerLabel: playerLabel(player),
    fromLabel: win.from === null ? null : playerLabel(gameState.players[win.from]),
    actionLabel: win.winType === 'tsumo' ? '自摸' : '荣和',
    concealedTiles: removeWinningTileForDisplay(player.hand, win.winTile, win.winType),
    winningTile: win.winTile,
    yaku: explicitDora ? win.yaku.filter((row) => !DORA_YAKU_NAMES.has(row.name)) : win.yaku,
    dora: {
      available: explicitDora,
      dora: win.dora,
      uraDora: win.uraDora,
      redDora: win.redDora,
      totalDora: win.totalDora,
    },
    han: win.han,
    fu: win.fu,
    limitLabel: authoritativeLimitLabel(win),
    resultPoints: win.points,
    winnerDelta: win.pointDeltas[win.winner] ?? 0,
    uraDoraIndicators: player.riichi
      ? activeUraDoraIndicators(gameState.deadWall, gameState.doraIndicators.length)
      : [],
  };
}

function buildScoreChanges(
  gameState: GameState,
  playerIds: readonly PlayerId[],
  pointDeltas: readonly number[],
  scoreBefore?: readonly number[],
  scoreAfter?: readonly number[],
): PlayerScoreChangeViewModel[] {
  return playerIds.map((playerId) => ({
    playerId,
    label: playerLabel(gameState.players[playerId]),
    delta: pointDeltas[playerId] ?? 0,
    scoreBefore: scoreBefore?.[playerId],
    scoreAfter: scoreAfter?.[playerId],
  }));
}

function authoritativeLimitLabel(win: WinResultEntry): string | null {
  if ((win.yakumanMultiplier ?? 0) > 0) {
    return win.yakumanMultiplier === 1 ? '役满' : `${win.yakumanMultiplier}倍役满`;
  }
  const labels = {
    mangan: '满贯',
    haneman: '跳满',
    baiman: '倍满',
    sanbaiman: '三倍满',
    yakuman: '役满',
    'counted-yakuman': '累计役满',
  } as const;
  return win.limitTier && win.limitTier !== 'none' ? labels[win.limitTier] : null;
}

function removeWinningTileForDisplay(hand: readonly Tile[], winningTile: Tile, winType: 'ron' | 'tsumo'): Tile[] {
  if (winType === 'ron') return [...hand];
  const instanceIndex = hand.findIndex((tile) => tile.instanceId === winningTile.instanceId);
  if (instanceIndex !== -1) return hand.filter((_, index) => index !== instanceIndex);
  const idIndex = hand.findIndex((tile) => tile.id === winningTile.id);
  return idIndex === -1 ? [...hand] : hand.filter((_, index) => index !== idIndex);
}

function playerLabel(player: PlayerState): string {
  return `${windLabel(player.seatWind)}家 ${player.name}`;
}

function abortiveDrawReasonLabel(reason: AbortiveDrawReason): string {
  const labels: Record<AbortiveDrawReason, string> = {
    'kyuushu-kyuuhai': '九种九牌',
    'suufon-renda': '四风连打',
    'suucha-riichi': '四家立直',
    'suukan-sanra': '四杠散了',
    sanchahou: '三家和了',
  };
  return labels[reason];
}

const DORA_YAKU_NAMES = new Set(['宝牌', '里宝牌', '赤宝牌']);

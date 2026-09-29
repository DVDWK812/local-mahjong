import type { SanmaState } from '../../game/sanma/types';
import { indicators } from '../../game/sanma/scoring';
import type { WinnerResultViewModel } from '../result/resultViewModel';
import { presentSanma } from './sanmaPresentation';
export function sanmaWinnerRows(state: SanmaState): WinnerResultViewModel[] {
  const view = presentSanma(state);
  return state.result?.winners.map(w => {
    const score = w.score, winningTile = state.wall.tiles[w.tile], player = view.players[w.winner];
    const source = { winner: w.winner, from: w.from, winType: w.from === null ? 'tsumo' as const : 'ron' as const, winTile: winningTile,
      yaku: score.yaku, han: score.han, fu: score.fu, points: w.income, pointDeltas: state.result!.deltas, yakumanMultiplier: score.yakumanMultiplier };
    const displayMelds = view.participants[w.winner].publicMelds?.map((meld, index) => ({ callType: meld.kind, caller: w.winner, calledFrom: state.players[w.winner].melds[index].from,
      sourceRelation: meld.kind === 'ankan' ? 'self' as const : (state.players[w.winner].melds[index].from - w.winner + 3) % 3 === 1 ? 'right' as const : 'left' as const,
      declaredAtTurn: index, tiles: meld.tiles.map(t => ({ tile: t.tile, instanceId: t.tile.instanceId, faceDown: t.faceDown, sideways: t.sideways, stacked: t.stacked, called: t.sideways })) }));
    return { displayMelds, key: `sanma-${state.roundSerial}-${w.winner}`, source, player, playerLabel: player.name, fromLabel: w.from === null ? null : state.players[w.from].name,
      actionLabel: w.from === null ? '自摸' : '荣和', concealedTiles: player.hand.filter(t => t.instanceId !== winningTile.instanceId), winningTile,
      yaku: score.yaku, dora: { available: true, dora: score.dora, uraDora: score.uraDora, redDora: score.redDora, totalDora: score.totalDora }, han: score.han, fu: score.fu,
      limitLabel: null, resultPoints: w.income, winnerDelta: state.result!.deltas[w.winner], uraDoraIndicators: player.riichi ? indicators(state, true) : [] };
  }) ?? [];
}

import { createSeventeenStepsGame, discardCandidate, passSeventeenStepsRon, type SeventeenStepsState } from '../game/seventeenSteps';
import { buildWall } from '../game/wall';
import type { TileId } from '../game/types';

/** The effective-tenpai hand from seventeenSteps.test; results still come from Rules. */
export function createSeventeenPresentationFixture(kind: 'initial' | 'ron' | 'last-turn' | 'cross-row'): SeventeenStepsState {
  const deck = buildWall();
  const take = (id: TileId) => { const index = deck.findIndex(tile => tile.id === id); if (index < 0) throw new Error('fixture 牌实例不足'); return deck.splice(index, 1)[0]; };
  const fixed = ([4, 4, 5, 6, 7, 10, 11, 12, 19, 20, 21, 22, 22] as TileId[]).map(take);
  const winning = take(4);
  const second = deck.splice(0, 13);
  const candidates0 = deck.splice(0, 21);
  const candidates1 = [winning, ...deck.splice(0, 20)];
  let state = createSeventeenStepsGame();
  state = { ...state, phase: 'active', currentPlayerId: 1, deadWall: deck.slice(-14), doraIndicators: [deck[deck.length - 8]], players: [
    { ...state.players[0], fixedHand: fixed, sourceTiles: [...fixed, ...candidates0], discardCandidates: candidates0, buildConfirmed: true },
    { ...state.players[1], fixedHand: second, sourceTiles: [...second, ...candidates1], discardCandidates: candidates1, buildConfirmed: true },
  ] };
  if (kind === 'ron') return discardCandidate(state, 1, winning.instanceId);
  state = { ...state, currentPlayerId: 0 };
  if (kind === 'initial') return state;
  for (let i = 0; i < (kind === 'cross-row' ? 18 : 32); i++) {
    const player = state.players[state.currentPlayerId];
    state = discardCandidate(state, player.id, player.discardCandidates[0].instanceId);
    if (state.phase === 'ron-window' && state.pendingRon) state = passSeventeenStepsRon(state, state.pendingRon.winnerId);
  }
  return state;
}

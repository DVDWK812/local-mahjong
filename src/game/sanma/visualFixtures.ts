import { applySanma, createSanma, legalSanmaActions } from './engine';
import { assertSanma } from './invariants';
import type { SanmaConfig } from './config';
import { SANMA_SEATS, type SanmaAction, type SanmaState } from './types';

/** Reach a long river through recorded legal calls/discards, never by inventing river history. */
export function longRiverFixture(config: SanmaConfig, seed: number): SanmaState {
  let state = createSanma(config, seed);
  for (let step = 0; step < 2000 && !state.completed; step++) {
    if (state.players.some(p => p.river.filter(r => !r.claimed).length > 18) && state.phase !== 'ended') return state;
    const actor = SANMA_SEATS.find(seat => legalSanmaActions(state, seat).length > 0);
    if (actor === undefined) throw new Error('长牌河构造缺少合法动作');
    const legal = legalSanmaActions(state, actor);
    const hand = state.players[actor].hand;
    const count = (instance: string) => {
      const tile = state.wall.tiles.find(t => t.instanceId === instance)!;
      return hand.filter(i => state.wall.tiles[i].id === tile.id).length;
    };
    const action = legal.find(a => a.type === 'pon') ?? legal.find(a => a.type === 'pass')
      ?? legal.filter((a): a is Extract<SanmaAction, { tile: string }> => a.type === 'discard').sort((a, b) => count(a.tile) - count(b.tile) || a.tile.localeCompare(b.tile))[0]
      ?? legal.find(a => a.type === 'next');
    if (!action) throw new Error('长牌河构造不能推进');
    state = applySanma(state, actor, action); assertSanma(state);
  }
  throw new Error(`种子${seed}在合法构造上限内未形成长牌河，请使用场景固定seed=100`);
}

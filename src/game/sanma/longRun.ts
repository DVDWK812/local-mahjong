import { createSanmaConfig, type SanmaLength, type TsumoPolicy } from './config';
import { applySanma, createSanma, legalSanmaActions } from './engine';
import { chooseSanmaAction, observeSanma } from './ai';
import { assertSanma } from './invariants';
import { replaySanma, saveSanma } from './persistence';
import { SANMA_SEATS } from './types';

export function runSanmaMatch(seed: number, length: SanmaLength, policy: TsumoPolicy, maxSteps = 10000) {
  const config = createSanmaConfig(length, policy), initial = createSanma(config, seed);
  let state = initial;
  for (let step = 0; step < maxSteps && !state.completed; step++) {
    const actor = SANMA_SEATS.find(id => legalSanmaActions(state, id).length > 0);
    if (actor === undefined) throw new Error(`永久等待 seed=${seed} step=${step} phase=${state.phase}`);
    const action = chooseSanmaAction(observeSanma(state, actor), actor === 0 ? undefined : config.ai[actor - 1]);
    if (!action) throw new Error(`AI无合法动作 seed=${seed} step=${step}`);
    const next = applySanma(state, actor, action);
    if (next === state) throw new Error(`非法动作 seed=${seed} step=${step} action=${JSON.stringify(action)}`);
    state = next; assertSanma(state);
  }
  if (!state.completed) throw new Error(`长跑步数保护触发 seed=${seed} steps=${state.sequence} trace=${JSON.stringify(state.actions.slice(-30))}`);
  const saved = saveSanma(state, undefined, initial); replaySanma(saved);
  return { seed, length, policy, startingPoints: config.startingPoints, targetPoints: config.targetPoints, returnPoints: config.returnPoints, actionSources: { policy: state.actions.filter(a => a.action.type !== 'next').length, roundTransition: state.actions.filter(a => a.action.type === 'next').length, explicitAuto: 0, timeout: 0 }, clockCoverage: 'none-direct-policy', rounds: state.roundSerial + 1, steps: state.sequence, end: state.endReason, scores: state.players.map(p => p.score), state };
}

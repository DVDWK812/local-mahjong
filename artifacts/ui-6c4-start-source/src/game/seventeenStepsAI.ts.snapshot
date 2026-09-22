import { analyzeSeventeenStepsTenpai, confirmBuild, type SeventeenStepsPlayerId, type SeventeenStepsState, type SeventeenStepsWaitAnalysis } from './seventeenSteps';
import { shanten } from './shanten';
import { sortTiles, tileLabel } from './tileUtils';
import type { Tile, TileId } from './types';

export interface SeventeenStepsAIV2Options {
  seed?: number;
  difficulty?: string;
  personality?: string;
  beamWidth?: number;
  maxEvaluatedCandidates?: number;
  localSwapRounds?: number;
  debug?: boolean;
}

export interface SeventeenStepsAIBuildDiagnostics {
  tier: 'han-and-no-furiten' | 'tenpai-and-no-furiten' | 'best-effort';
  evaluatedCandidates: number;
  searchBudget: number;
  structureWaitIds: TileId[];
  eligibleWaitIds: TileId[];
  legalWaitIds: TileId[];
  hasLegalWait: boolean;
  candidatePoolWaitEntities: number;
  forcedWaitDiscards: number;
  legalWaitTypeCount: number;
  potentialRonCopies: number;
  hanMargin: number;
  expectedScore: number;
  forcedFuriten: boolean;
  logs: string[];
}

export interface SeventeenStepsAIBuildResult {
  fixedHand: Tile[];
  discardCandidates: Tile[];
  waits: SeventeenStepsWaitAnalysis[];
  diagnostics: SeventeenStepsAIBuildDiagnostics;
}

const DEFAULT_OPTIONS: Required<SeventeenStepsAIV2Options> = {
  seed: 0,
  difficulty: '',
  personality: '',
  beamWidth: 32,
  maxEvaluatedCandidates: 64,
  localSwapRounds: 2,
  debug: false,
};

interface BeamNode {
  indices: number[];
  hand: Tile[];
}

interface EvaluatedBuild extends SeventeenStepsAIBuildResult {
  isTenpai: boolean;
}

export type SeventeenStepsAIDifficulty = 'chikukon' | 'shintentai' | 'upper' | 'kishin' | string;

export interface SeventeenStepsAIConfig {
  difficulty?: SeventeenStepsAIDifficulty;
  personality?: string;
  seed?: number;
}

export interface SeventeenStepsAIController {
  kind: 'legacy' | 'v2.1';
  build(state: SeventeenStepsState, playerId?: SeventeenStepsPlayerId): SeventeenStepsAIBuildResult;
  discard(state: SeventeenStepsState, playerId?: SeventeenStepsPlayerId): Tile | null;
  shouldRon(state: SeventeenStepsState, playerId?: SeventeenStepsPlayerId): boolean;
}

export function getSeventeenStepsForcedWaitDiscards(waitEntities: number): number {
  return Math.max(0, waitEntities - 4);
}

/**
 * Default 17-step AI V2. The seed only affects deterministic tie-breaking;
 * hidden opponent build data is never included in the AI perspective.
 */
export const SeventeenStepsDefaultAIV21: SeventeenStepsAIController = {
  kind: 'v2.1',
  build(state, playerId = 1) {
    return buildSeventeenStepsHandV21(state, playerId);
  },
  discard(state, playerId = 1) {
    return chooseSeventeenStepsAIDiscardV21(state, playerId);
  },
  shouldRon(state, playerId = 1) {
    return state.phase === 'ron-window' && state.pendingRon?.winnerId === playerId;
  },
};

/** Backwards-compatible name; the default implementation is now V2.1. */
export const SeventeenStepsDefaultAI = SeventeenStepsDefaultAIV21;

export function createSeventeenStepsAI(config: SeventeenStepsAIConfig = {}): SeventeenStepsAIController {
  if (config.difficulty === 'chikukon') {
    return {
      kind: 'legacy',
      build: (state, playerId = 1) => buildSeventeenStepsLegacyAI(state, playerId),
      discard: (state, playerId = 1) => chooseSeventeenStepsLegacyAIDiscard(state, playerId),
      shouldRon: (state, playerId = 1) => state.phase === 'ron-window' && state.pendingRon?.winnerId === playerId,
    };
  }
  const options: SeventeenStepsAIV2Options = {
    difficulty: config.difficulty,
    personality: config.personality,
    seed: config.seed,
  };
  return {
    kind: 'v2.1',
    build: (state, playerId = 1) => buildSeventeenStepsHandV21(state, playerId, options),
    discard: (state, playerId = 1) => chooseSeventeenStepsAIDiscardV21(state, playerId, options),
    shouldRon: (state, playerId = 1) => state.phase === 'ron-window' && state.pendingRon?.winnerId === playerId,
  };
}

export function createSeventeenStepsAIGame(state: SeventeenStepsState, config: SeventeenStepsAIConfig = {}): SeventeenStepsState {
  if (state.phase !== 'build') return state;
  const controller = createSeventeenStepsAI(config);
  const result = controller.build(state, 1);
  const aiPlayer = state.players[1];
  return confirmBuild({
    ...state,
    players: [state.players[0], {
      ...aiPlayer,
      fixedHand: result.fixedHand,
      discardCandidates: result.discardCandidates,
      buildConfirmed: false,
    }],
  }, 1);
}

export function createSeventeenStepsDefaultAIGame(state: SeventeenStepsState, options: SeventeenStepsAIV2Options = {}): SeventeenStepsState {
  return createSeventeenStepsAIGame(state, { difficulty: options.difficulty ?? 'shintentai', personality: options.personality, seed: options.seed });
}

/** Kept only as a regression baseline. It is not used by the default game. */
export function buildSeventeenStepsLegacyAI(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId = 1): SeventeenStepsAIBuildResult {
  const source = [...state.players[playerId].sourceTiles].sort(compareTiles);
  const fixedHand = source.slice(0, 13);
  const discardCandidates = source.slice(13);
  const perspective = aiPerspective({
    ...state,
    players: state.players.map((player, index) => index === playerId
      ? { ...player, fixedHand, discardCandidates, buildConfirmed: false }
      : player) as [typeof state.players[0], typeof state.players[1]],
  }, playerId);
  const waits = analyzeSeventeenStepsTenpai(perspective, playerId);
  const structureWaitIds = waits.map((wait) => wait.id);
  return {
    fixedHand,
    discardCandidates,
    waits,
    diagnostics: {
      tier: 'best-effort',
      evaluatedCandidates: 1,
      searchBudget: 1,
      structureWaitIds,
      eligibleWaitIds: waits.filter((wait) => wait.meetsHanRestriction).map((wait) => wait.id),
      legalWaitIds: waits.filter((wait) => wait.meetsHanRestriction).map((wait) => wait.id),
      hasLegalWait: waits.some((wait) => wait.meetsHanRestriction),
      candidatePoolWaitEntities: discardCandidates.filter((tile) => structureWaitIds.includes(tile.id)).length,
      forcedWaitDiscards: getSeventeenStepsForcedWaitDiscards(discardCandidates.filter((tile) => structureWaitIds.includes(tile.id)).length),
      legalWaitTypeCount: waits.filter((wait) => wait.meetsHanRestriction).length,
      potentialRonCopies: waits.filter((wait) => wait.meetsHanRestriction).reduce((sum, wait) => sum + wait.remaining, 0),
      hanMargin: waits.length > 0 ? Math.min(...waits.filter((wait) => wait.meetsHanRestriction).map((wait) => wait.restrictionHan - state.matchConfig.hanRestriction), 0) : 0,
      expectedScore: waits.length > 0 ? waits.reduce((sum, wait) => sum + (wait.score.points.ron ?? 0), 0) / waits.length : 0,
      forcedFuriten: discardCandidates.filter((tile) => structureWaitIds.includes(tile.id)).length > 4,
      logs: ['legacy'],
    },
  };
}

export function chooseSeventeenStepsLegacyAIDiscard(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId = 1): Tile | null {
  return state.players[playerId].discardCandidates[0] ?? null;
}

export function buildSeventeenStepsHandV21(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId = 1, options: SeventeenStepsAIV2Options = {}): SeventeenStepsAIBuildResult {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const source = [...state.players[playerId].sourceTiles].sort(compareTiles);
  const candidates = generateCandidateHands(source, config);
  const evaluations: EvaluatedBuild[] = [];
  for (const hand of candidates.slice(0, config.maxEvaluatedCandidates)) {
    const evaluation = evaluateBuildCandidate(state, playerId, hand, config);
    evaluations.push(evaluation);
  }

  const best = evaluations.sort(compareEvaluatedBuilds)[0] ?? evaluateBuildCandidate(state, playerId, source.slice(0, 13), config);
  const diagnostics = {
    ...best.diagnostics,
    evaluatedCandidates: evaluations.length,
    logs: config.debug ? best.diagnostics.logs : [],
  };
  return { ...best, diagnostics };
}

export function buildSeventeenStepsHandV2(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId = 1, options: SeventeenStepsAIV2Options = {}): SeventeenStepsAIBuildResult {
  return buildSeventeenStepsHandV21(state, playerId, options);
}

export function chooseSeventeenStepsAIDiscardV21(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId = 1, options: SeventeenStepsAIV2Options = {}): Tile | null {
  if (state.phase !== 'active' || state.currentPlayerId !== playerId) return null;
  const player = state.players[playerId];
  const structureWaitIds = new Set(analyzeSeventeenStepsTenpai(aiPerspective(state, playerId), playerId).map((wait) => wait.id));
  const nonWaitCandidates = player.discardCandidates.filter((tile) => !structureWaitIds.has(tile.id));
  const waitCandidates = player.discardCandidates.filter((tile) => structureWaitIds.has(tile.id));
  const candidates = nonWaitCandidates.length > 0 ? nonWaitCandidates : waitCandidates;
  if (candidates.length === 0) return null;

  const opponent = state.players[playerId === 0 ? 1 : 0];
  const publicSafeIds = new Set(opponent.discardedTiles.map((tile) => tile.id));
  return [...candidates].sort((a, b) => {
    const aSafe = publicSafeIds.has(a.id) ? 1 : 0;
    const bSafe = publicSafeIds.has(b.id) ? 1 : 0;
    if (aSafe !== bSafe) return bSafe - aSafe;
    const aCopies = player.discardCandidates.filter((tile) => tile.id === a.id).length;
    const bCopies = player.discardCandidates.filter((tile) => tile.id === b.id).length;
    if (aCopies !== bCopies) return bCopies - aCopies;
    const dangerDiff = discardDanger(a.id, state) - discardDanger(b.id, state);
    if (dangerDiff !== 0) return dangerDiff;
    const tieA = seededTie(a.id, configSeed(options));
    const tieB = seededTie(b.id, configSeed(options));
    if (tieA !== tieB) return tieA - tieB;
    return compareTiles(a, b);
  })[0];
}

export function chooseSeventeenStepsAIDiscardV2(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId = 1, options: SeventeenStepsAIV2Options = {}): Tile | null {
  return chooseSeventeenStepsAIDiscardV21(state, playerId, options);
}

function evaluateBuildCandidate(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId, fixedHand: Tile[], options: Required<SeventeenStepsAIV2Options>): EvaluatedBuild {
  const sortedHand = [...fixedHand].sort(compareTiles);
  const fixedIds = new Set(sortedHand.map((tile) => tile.instanceId));
  const discardCandidates = state.players[playerId].sourceTiles.filter((tile) => !fixedIds.has(tile.instanceId)).sort(compareTiles);
  const candidateState = aiPerspective({
    ...state,
    players: state.players.map((player, index) => index === playerId
      ? { ...player, fixedHand: sortedHand, discardCandidates, buildConfirmed: false }
      : player) as [typeof state.players[0], typeof state.players[1]],
  }, playerId);
  const waits = analyzeSeventeenStepsTenpai(candidateState, playerId);
  const eligibleWaits = waits.filter((wait) => wait.meetsHanRestriction);
  const structureWaitIds = waits.map((wait) => wait.id);
  const eligibleWaitIds = eligibleWaits.map((wait) => wait.id);
  const candidatePoolWaitEntities = discardCandidates.filter((tile) => structureWaitIds.includes(tile.id)).length;
  const tenpai = shanten(sortedHand).best === 0;
  const forcedWaitDiscards = getSeventeenStepsForcedWaitDiscards(candidatePoolWaitEntities);
  const hasLegalWait = eligibleWaits.length > 0;
  const legalWaitTypeCount = eligibleWaits.length;
  const potentialRonCopies = eligibleWaits.reduce((sum, wait) => sum + wait.remaining, 0);
  const hanMargin = hasLegalWait
    ? Math.min(...eligibleWaits.map((wait) => wait.restrictionHan - candidateState.matchConfig.hanRestriction))
    : 0;
  const expectedScore = hasLegalWait
    ? eligibleWaits.reduce((sum, wait) => sum + (wait.score.points.ron ?? 0), 0) / legalWaitTypeCount
    : 0;
  const tierScore = tenpai && hasLegalWait && forcedWaitDiscards === 0 ? 4 : tenpai && hasLegalWait ? 3 : tenpai ? 2 : 1;
  const logs = options.debug
    ? [`候选 ${sortedHand.map((tile) => tileLabel(tile)).join(' ')}：${tierScore >= 3 ? '番缚+无振听' : tierScore === 2 ? '听牌+无振听' : 'best-effort'}，结构待牌 ${structureWaitIds.length} 种，候选池待牌实体 ${candidatePoolWaitEntities} 张`]
    : [];
  return {
    fixedHand: sortedHand,
    discardCandidates,
    waits,
    diagnostics: {
      tier: hasLegalWait && forcedWaitDiscards === 0 ? 'han-and-no-furiten' : tenpai && forcedWaitDiscards === 0 ? 'tenpai-and-no-furiten' : 'best-effort',
      evaluatedCandidates: 0,
      searchBudget: options.maxEvaluatedCandidates,
      structureWaitIds,
      eligibleWaitIds,
      legalWaitIds: eligibleWaitIds,
      hasLegalWait,
      candidatePoolWaitEntities,
      forcedWaitDiscards,
      legalWaitTypeCount,
      potentialRonCopies,
      hanMargin,
      expectedScore,
      forcedFuriten: forcedWaitDiscards > 0,
      logs,
    },
    isTenpai: tenpai,
  };
}

function compareEvaluatedBuilds(a: EvaluatedBuild, b: EvaluatedBuild): number {
  if (a.isTenpai !== b.isTenpai) return a.isTenpai ? -1 : 1;
  if (a.diagnostics.hasLegalWait !== b.diagnostics.hasLegalWait) return a.diagnostics.hasLegalWait ? -1 : 1;
  if (a.diagnostics.forcedWaitDiscards !== b.diagnostics.forcedWaitDiscards) return a.diagnostics.forcedWaitDiscards - b.diagnostics.forcedWaitDiscards;
  if (a.diagnostics.legalWaitTypeCount !== b.diagnostics.legalWaitTypeCount) return b.diagnostics.legalWaitTypeCount - a.diagnostics.legalWaitTypeCount;
  if (a.diagnostics.potentialRonCopies !== b.diagnostics.potentialRonCopies) return b.diagnostics.potentialRonCopies - a.diagnostics.potentialRonCopies;
  if (a.diagnostics.hanMargin !== b.diagnostics.hanMargin) return b.diagnostics.hanMargin - a.diagnostics.hanMargin;
  if (a.diagnostics.expectedScore !== b.diagnostics.expectedScore) return b.diagnostics.expectedScore - a.diagnostics.expectedScore;
  return compareHands(a.fixedHand, b.fixedHand);
}

function generateCandidateHands(source: Tile[], options: Required<SeventeenStepsAIV2Options>): Tile[][] {
  let beam: BeamNode[] = [{ indices: [], hand: [] }];
  for (let depth = 0; depth < 13; depth += 1) {
    const expanded: BeamNode[] = [];
    for (const node of beam) {
      const start = node.indices.length === 0 ? 0 : node.indices[node.indices.length - 1] + 1;
      for (let index = start; index < source.length; index += 1) {
        const hand = [...node.hand, source[index]];
        expanded.push({ indices: [...node.indices, index], hand });
      }
    }
    expanded.sort((a, b) => compareBeamNodes(a, b, options.seed));
    beam = retainDiverseBeam(expanded, options.beamWidth);
  }

  const refined = beam.slice(0, Math.min(4, beam.length)).flatMap((node) => localSwapCandidates(node, source, options));
  const windows = Array.from({ length: Math.max(0, source.length - 12) }, (_, start) => source.slice(start, start + 13));
  const all = [...windows, ...beam.map((node) => node.hand), ...refined];
  const seen = new Set<string>();
  const unique = all.filter((hand) => {
    const key = hand.map((tile) => tile.instanceId).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.sort((a, b) => comparePartialHands(a, b, options.seed));
}

function localSwapCandidates(node: BeamNode, source: Tile[], options: Required<SeventeenStepsAIV2Options>): Tile[][] {
  let frontier = [node.hand];
  for (let round = 0; round < options.localSwapRounds; round += 1) {
    const neighbors: Tile[][] = [];
    for (const hand of frontier) {
      const handIds = new Set(hand.map((tile) => tile.instanceId));
      for (const removed of hand) {
        for (const added of source) {
          if (handIds.has(added.instanceId)) continue;
          const next = hand.filter((tile) => tile.instanceId !== removed.instanceId).concat(added).sort(compareTiles);
          neighbors.push(next);
        }
      }
    }
    neighbors.sort((a, b) => {
      const potentialDiff = structurePotential(b) - structurePotential(a);
      return potentialDiff || seededTie(handHash(a), options.seed) - seededTie(handHash(b), options.seed);
    });
    frontier = neighbors.slice(0, 8);
  }
  return frontier;
}

function retainDiverseBeam(nodes: BeamNode[], width: number): BeamNode[] {
  const result: BeamNode[] = [];
  const perFirstTile = new Map<number, number>();
  for (const node of nodes) {
    const first = node.hand[0]?.id ?? -1;
    const count = perFirstTile.get(first) ?? 0;
    if (count >= Math.max(3, Math.floor(width / 20))) continue;
    result.push(node);
    perFirstTile.set(first, count + 1);
    if (result.length >= width) break;
  }
  return result.length > 0 ? result : nodes.slice(0, width);
}

function compareBeamNodes(a: BeamNode, b: BeamNode, seed: number): number {
  return comparePartialHands(a.hand, b.hand, seed) || compareIndices(a.indices, b.indices);
}

function comparePartialHands(a: Tile[], b: Tile[], seed: number): number {
  if (a.length === 13 && b.length === 13) {
    const shantenDiff = shanten(a).best - shanten(b).best;
    if (shantenDiff !== 0) return shantenDiff;
  }
  const potentialDiff = structurePotential(b) - structurePotential(a);
  if (potentialDiff !== 0) return potentialDiff;
  return seededTie(handHash(a), seed) - seededTie(handHash(b), seed);
}

function structurePotential(hand: Tile[]): number {
  const counts = new Map<TileId, number>();
  hand.forEach((tile) => counts.set(tile.id, (counts.get(tile.id) ?? 0) + 1));
  let value = 0;
  for (const [id, count] of counts) {
    value += count * count;
    if (count >= 2) value += 2;
    if (id < 27) {
      if (counts.has((id - 1) as TileId) && id % 9 !== 0) value += 1;
      if (counts.has((id + 1) as TileId) && id % 9 !== 8) value += 1;
    }
  }
  return value;
}

function aiPerspective(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId): SeventeenStepsState {
  const opponentId = playerId === 0 ? 1 : 0;
  return {
    ...state,
    players: state.players.map((player, index) => index === opponentId
      ? { ...player, sourceTiles: [], fixedHand: [], discardCandidates: [] }
      : player) as [typeof state.players[0], typeof state.players[1]],
    // Keep the public river and the AI's own private tiles only.
    currentPlayerId: state.currentPlayerId,
  };
}

function discardDanger(id: TileId, state: SeventeenStepsState): number {
  const rank = id < 27 ? (id % 9) + 1 : 0;
  const isPublicSafe = state.players.some((player) => player.discardedTiles.some((tile) => tile.id === id));
  if (isPublicSafe) return -100;
  if (id >= 27) return 0;
  if (rank === 1 || rank === 9) return 1;
  if (rank === 2 || rank === 8) return 2;
  return 3;
}

function configSeed(options: SeventeenStepsAIV2Options): number {
  return options.seed ?? DEFAULT_OPTIONS.seed;
}

function seededTie(value: number, seed: number): number {
  let hash = (value ^ seed) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 2246822519) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 3266489917) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}

function handHash(hand: Tile[]): number {
  return hand.reduce((hash, tile) => (hash * 37 + tile.id * 2 + (tile.red ? 1 : 0)) >>> 0, 17);
}

function compareIndices(a: number[], b: number[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

function compareHands(a: Tile[], b: Tile[]): number {
  const left = [...a].sort(compareTiles);
  const right = [...b].sort(compareTiles);
  for (let index = 0; index < left.length; index += 1) {
    const idDiff = left[index].id - right[index].id;
    if (idDiff !== 0) return idDiff;
    if (left[index].red !== right[index].red) return left[index].red ? -1 : 1;
    const instanceDiff = left[index].instanceId.localeCompare(right[index].instanceId);
    if (instanceDiff !== 0) return instanceDiff;
  }
  return 0;
}

function compareTiles(a: Tile, b: Tile): number {
  return sortTiles(a, b);
}

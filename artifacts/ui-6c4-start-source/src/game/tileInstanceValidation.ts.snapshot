import type { CallSet, GameState, PlayerId, Tile } from './types';

type EffectiveRegion = 'hand' | 'live-wall' | 'dead-wall' | 'call' | 'unclaimed-river';

interface EffectiveOccurrence {
  region: EffectiveRegion;
  label: string;
  tile: Tile;
  call?: CallSet;
  callOwner?: PlayerId;
}

interface ClaimedRiverOccurrence {
  tile: Tile;
  riverOwner: PlayerId;
}

/**
 * 校验物理牌实例的有效占用。drawnTile、宝牌指示牌等只是已有槽位的视图引用；
 * claimed 牌河和固定王牌中已使用的岭上槽是历史记录，不构成第二份有效占用。
 */
export function validateTileInstanceRegions(state: GameState): string[] {
  const issues: string[] = [];
  const effective = new Map<string, EffectiveOccurrence[]>();
  const claimedHistory = new Map<string, ClaimedRiverOccurrence[]>();
  const calls: Array<{ call: CallSet; owner: PlayerId }> = [];
  const addEffective = (tile: Tile, occurrence: Omit<EffectiveOccurrence, 'tile'>) => {
    const entries = effective.get(tile.instanceId) ?? [];
    entries.push({ ...occurrence, tile });
    effective.set(tile.instanceId, entries);
  };

  state.players.forEach((player) => {
    player.hand.forEach((tile) => addEffective(tile, { region: 'hand', label: `player ${player.id} hand` }));
    player.calls.forEach((call, callIndex) => {
      calls.push({ call, owner: player.id });
      call.tiles.forEach((tile) => addEffective(tile, {
        region: 'call',
        label: `player ${player.id} call ${callIndex}`,
        call,
        callOwner: player.id,
      }));
    });
    player.river.forEach((tile) => {
      if (tile.claimed) {
        const entries = claimedHistory.get(tile.instanceId) ?? [];
        entries.push({ tile, riverOwner: player.id });
        claimedHistory.set(tile.instanceId, entries);
      } else {
        if (tile.claimedBy !== undefined) issues.push(`Unclaimed river tile ${tile.instanceId} must not have claimedBy`);
        addEffective(tile, { region: 'unclaimed-river', label: `player ${player.id} river` });
      }
    });
  });

  state.wall.forEach((tile) => addEffective(tile, { region: 'live-wall', label: 'live wall' }));
  const completedKanCount = state.players.reduce(
    (count, player) => count + player.calls.filter((call) => call.type === 'kan').length,
    0,
  );
  const fixedDeadWallUsedRinshan = state.deadWall.length === 14
    ? Math.min(4, completedKanCount)
    : 0;
  state.deadWall.forEach((tile, index) => {
    if (index >= fixedDeadWallUsedRinshan) addEffective(tile, { region: 'dead-wall', label: `dead wall ${index}` });
  });

  for (const [instanceId, occurrences] of effective) {
    if (occurrences.length > 1) {
      issues.push(`Duplicate tile instance ${instanceId} in effective occupancy: ${occurrences.map((entry) => entry.label).join(', ')}`);
    }
  }

  for (const [instanceId, histories] of claimedHistory) {
    if (histories.length !== 1) {
      issues.push(`Invalid claimed river alias ${instanceId}: history must appear exactly once`);
      continue;
    }
    const history = histories[0];
    const occurrences = effective.get(instanceId) ?? [];
    if (occurrences.length !== 1 || occurrences[0].region !== 'call') {
      issues.push(`Invalid claimed river alias ${instanceId}: must reference exactly one call`);
      continue;
    }
    const occurrence = occurrences[0];
    if (!isMatchingClaimedCall(history, occurrence)) {
      issues.push(`Invalid claimed river alias ${instanceId}: claimedBy, source, call type, or tile identity does not match`);
    }
  }

  for (const { call, owner } of calls) {
    if (!requiresClaimedHistory(call)) continue;
    const matchingHistories = call.tiles.flatMap((tile) => claimedHistory.get(tile.instanceId) ?? []);
    if (matchingHistories.length !== 1) {
      issues.push(`Invalid claimed river alias for player ${owner} call: open call must reference exactly one claimed river tile`);
      continue;
    }
    const history = matchingHistories[0];
    const occurrence = (effective.get(history.tile.instanceId) ?? []).find((entry) => entry.call === call && entry.callOwner === owner);
    if (!occurrence || !isMatchingClaimedCall(history, occurrence)) {
      issues.push(`Invalid claimed river alias ${history.tile.instanceId}: reverse call mapping does not match`);
    }
  }

  return issues;
}

function requiresClaimedHistory(call: CallSet): boolean {
  return call.type === 'chi'
    || call.type === 'pon'
    || (call.type === 'kan' && (call.kanType === 'minkan' || call.kanType === 'kakan'));
}

function isMatchingClaimedCall(history: ClaimedRiverOccurrence, occurrence: EffectiveOccurrence): boolean {
  const { tile, riverOwner } = history;
  const { call, callOwner } = occurrence;
  if (!call || callOwner === undefined || !isPlayerId(tile.claimedBy)) return false;
  if (tile.claimedBy !== callOwner || call.from !== riverOwner || callOwner === riverOwner || !call.opened) return false;
  if (occurrence.tile.id !== tile.id || occurrence.tile.red !== tile.red) return false;

  if (call.type === 'chi') {
    return callOwner === ((riverOwner + 1) % 4)
      && call.tiles.length === 3
      && call.calledTile?.instanceId === tile.instanceId;
  }
  if (call.type === 'pon') {
    return call.tiles.length === 3
      && call.tiles.every((entry) => entry.id === tile.id)
      && (!call.calledTile || call.calledTile.instanceId === tile.instanceId);
  }
  if (call.type === 'kan' && (call.kanType === 'minkan' || call.kanType === 'kakan')) {
    return call.tiles.length === 4
      && call.tiles.every((entry) => entry.id === tile.id)
      && (call.kanType !== 'minkan' || call.calledTile?.instanceId === tile.instanceId)
      && (!call.calledTile || call.calledTile.instanceId === tile.instanceId);
  }
  return false;
}

function isPlayerId(value: unknown): value is PlayerId {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 3;
}

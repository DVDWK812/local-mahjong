import type { CallSet, PlayerId, Tile } from './types';

export type RelativeCallSource = 'left' | 'opposite' | 'right' | 'self';

export interface MeldDisplayTile {
  tile: Tile;
  instanceId: string;
  faceDown: boolean;
  sideways: boolean;
  stacked: boolean;
  called: boolean;
}

export interface MeldDisplayModel {
  callType: 'chi' | 'pon' | 'ankan' | 'minkan' | 'kakan';
  caller: PlayerId;
  calledFrom?: PlayerId;
  sourceRelation: RelativeCallSource;
  tiles: MeldDisplayTile[];
  declaredAtTurn?: number;
}

export function callsToMeldDisplayModels(calls: CallSet[], caller: PlayerId): MeldDisplayModel[] {
  return calls.map((call, index) => callToMeldDisplayModel(call, caller, index));
}

export function callToMeldDisplayModel(call: CallSet, caller: PlayerId, index = 0): MeldDisplayModel {
  const callType = call.type === 'kan' ? call.kanType ?? 'minkan' : call.type;
  const calledFrom = callType === 'ankan' ? undefined : call.from;
  const sourceRelation = calledFrom === undefined ? 'self' : relativeCallSource(caller, calledFrom);
  const calledIndex = calledFrom === undefined ? -1 : calledTileIndex(callType, sourceRelation, call.tiles.length);
  const tiles = orderTilesForDisplay(call, callType, calledIndex).map((tile, tileIndex) => ({
    tile,
    instanceId: tile.instanceId,
    faceDown: callType === 'ankan' && (tileIndex === 0 || tileIndex === 3),
    sideways: tileIndex === calledIndex && callType !== 'ankan',
    stacked: callType === 'kakan' && tileIndex === 3,
    called: tileIndex === calledIndex && callType !== 'ankan',
  }));
  return {
    callType,
    caller,
    calledFrom,
    sourceRelation,
    tiles,
    declaredAtTurn: index,
  };
}

export function relativeCallSource(caller: PlayerId, calledFrom: PlayerId): RelativeCallSource {
  const offset = (calledFrom - caller + 4) % 4;
  if (offset === 3) return 'left';
  if (offset === 2) return 'opposite';
  if (offset === 1) return 'right';
  return 'self';
}

function calledTileIndex(callType: MeldDisplayModel['callType'], relation: RelativeCallSource, length: number): number {
  if (callType === 'chi') return 0;
  if (relation === 'left') return 0;
  if (relation === 'opposite') return length === 4 ? 1 : 1;
  if (relation === 'right') return length - 1;
  return 0;
}

function orderTilesForDisplay(call: CallSet, callType: MeldDisplayModel['callType'], calledIndex: number): Tile[] {
  if (callType === 'ankan') return [...call.tiles];
  if (callType === 'kakan') return orderKakanTiles(call, calledIndex);
  const calledTile = call.calledTile
    ? call.tiles.find((tile) => tile.instanceId === call.calledTile?.instanceId) ?? call.tiles.find((tile) => tile.id === call.calledTile?.id) ?? call.tiles[calledIndex]
    : call.tiles[calledIndex];
  if (!calledTile) return [...call.tiles];
  const others = call.tiles
    .filter((tile) => tile.instanceId !== calledTile.instanceId)
    .sort((a, b) => a.id - b.id || a.instanceId.localeCompare(b.instanceId));
  const ordered = [...others];
  ordered.splice(Math.min(calledIndex, ordered.length), 0, calledTile);
  return ordered;
}

function orderKakanTiles(call: CallSet, calledIndex: number): Tile[] {
  const baseTiles = call.tiles.slice(0, 3);
  const base = call.calledTile
    ? orderTilesForDisplay({ ...call, type: 'pon', tiles: baseTiles }, 'pon', calledIndex)
    : baseTiles;
  const stacked = call.tiles.find((tile) => !base.some((baseTile) => baseTile.instanceId === tile.instanceId)) ?? call.tiles[3];
  return stacked ? [...base, stacked] : base;
}

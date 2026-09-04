import { describe, expect, it } from 'vitest';
import { createDefaultAppearanceSettings } from './appearanceSettings';
import { collectPlayerSlotAppearanceAssetIds, createPlayerSlotAppearanceStore, DEFAULT_PLAYER_SLOT_APPEARANCES, loadPlayerSlotAppearances, PLAYER_APPEARANCE_SLOTS, PLAYER_SLOT_APPEARANCE_KEY, resolvePlayerSlotAppearance } from './playerSlotAppearance';

function memory() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
describe('player-owned appearance selection', () => {
  it('defaults to inherit, persists four independent stable IDs and keeps global unchanged', () => {
    const storage = memory(); const store = createPlayerSlotAppearanceStore(storage);
    expect(store.getSnapshot()).toEqual(DEFAULT_PLAYER_SLOT_APPEARANCES);
    const global = createDefaultAppearanceSettings();
    for (const slot of PLAYER_APPEARANCE_SLOTS) store.select(slot, {
      tileBack: { texture: { kind: 'local', assetId: `back-${slot}` }, sideColor: ['#ff0000', '#0000ff', '#008000', '#800080'][slot] },
      riichiStick: { kind: 'local', assetId: `stick-${slot}` },
    });
    const players = loadPlayerSlotAppearances(storage);
    expect(players).toEqual(store.getSnapshot());
    for (const rotatedIds of [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2]]) {
      rotatedIds.forEach(id => expect(resolvePlayerSlotAppearance(id, players, global).tileBack.texture).toEqual({ kind: 'local', assetId: `back-${id}` }));
    }
    expect(resolvePlayerSlotAppearance(undefined, players, global).tileBack).toEqual(global.tileBack);
    expect(resolvePlayerSlotAppearance(99, players, global).riichiStick).toEqual(global.riichiStick.asset);
    expect(global).toEqual(createDefaultAppearanceSettings());
  });
  it('clears all users of a deleted shared asset to inherit without resetting colors or unrelated assets', () => {
    const storage = memory(); const store = createPlayerSlotAppearanceStore(storage);
    for (const slot of PLAYER_APPEARANCE_SLOTS) store.select(slot, { tileBack: { texture: { kind: 'local', assetId: 'shared' }, sideColor: '#123456' }, riichiStick: { kind: 'local', assetId: slot === 2 ? 'other' : 'shared' } });
    expect([...collectPlayerSlotAppearanceAssetIds(store.getSnapshot())]).toEqual(['shared', 'other']);
    store.removeAsset('shared');
    expect([...collectPlayerSlotAppearanceAssetIds(loadPlayerSlotAppearances(storage))]).toEqual(['other']);
    for (const slot of PLAYER_APPEARANCE_SLOTS) expect(store.getSnapshot()[slot].tileBack).toEqual({ texture: 'inherit', sideColor: '#123456' });
    expect(store.getSnapshot()[2].riichiStick).toEqual({ kind: 'local', assetId: 'other' });
  });
  it('separates explicit default from inherit and preserves fields when changing selection', () => {
    const store = createPlayerSlotAppearanceStore(memory()); const global = createDefaultAppearanceSettings();
    const customGlobal = { ...global, tileBack: { texture: { kind: 'local' as const, assetId: 'global' }, sideColor: '#abcdef' } };
    expect(resolvePlayerSlotAppearance(0, store.getSnapshot(), customGlobal).tileBack).toEqual(customGlobal.tileBack);
    store.select(0, { tileBack: { texture: { kind: 'builtin', id: 'default' }, sideColor: 'inherit' }, riichiStick: 'inherit' });
    expect(resolvePlayerSlotAppearance(0, store.getSnapshot(), customGlobal).tileBack).toEqual({ texture: { kind: 'builtin', id: 'default' }, sideColor: '#abcdef' });
  });
  it('falls back for malformed, future, invalid refs/colors and refuses unsafe deletion on quota failure', () => {
    const storage = memory();
    for (const raw of ['{', 'null', '{"version":99}']) { storage.setItem(PLAYER_SLOT_APPEARANCE_KEY, raw); expect(loadPlayerSlotAppearances(storage)).toEqual(DEFAULT_PLAYER_SLOT_APPEARANCES); }
    storage.setItem(PLAYER_SLOT_APPEARANCE_KEY, JSON.stringify({ version: 1, players: { 0: { tileBack: { texture: { kind: 'local', assetId: '' }, sideColor: 'red' }, riichiStick: 'bad' } } }));
    expect(loadPlayerSlotAppearances(storage)).toEqual(DEFAULT_PLAYER_SLOT_APPEARANCES);
    const store = createPlayerSlotAppearanceStore(storage);
    store.select(0, { tileBack: { texture: { kind: 'local', assetId: 'protected' }, sideColor: 'inherit' }, riichiStick: 'inherit' });
    storage.setItem = () => { throw new Error('quota'); };
    expect(() => store.removeAsset('protected')).toThrow('quota');
    expect(collectPlayerSlotAppearanceAssetIds(store.getSnapshot()).has('protected')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { createPlayerSlotAvatarStore, loadPlayerSlotAvatars, loadPlayerSlotNicknames, PLAYER_SLOT_AVATARS_KEY, resolvePlayerSlotAvatar, resolvePlayerSlotNickname } from './playerSlotAvatars';
import { DEFAULT_AVATAR_ID } from '../../profile/avatars';

function memory() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
describe('stable presentation player-slot avatars', () => {
  it('migrates v1 avatars and persists independent validated nicknames in v2', () => {
    const storage = memory();
    storage.setItem(PLAYER_SLOT_AVATARS_KEY, JSON.stringify({ version: 1, avatars: { 1: 'tile-m1', 2: 'custom:shared', 3: DEFAULT_AVATAR_ID } }));
    const store = createPlayerSlotAvatarStore(storage);
    expect(store.getNicknames()[1]).toBe('Player 2');
    store.setNickname(1, '  小明  '); store.setNickname(2, '🀄'.repeat(15)); store.setNickname(3, '小红');
    expect(loadPlayerSlotNicknames(storage)).toEqual({ 1: '小明', 2: '🀄'.repeat(12), 3: '小红' });
    expect(loadPlayerSlotAvatars(storage)[1]).toBe('tile-m1');
    store.removeAsset('shared'); store.select(1, DEFAULT_AVATAR_ID);
    expect(loadPlayerSlotNicknames(storage)[1]).toBe('小明');
    expect(() => store.setNickname(1, '  ')).toThrow();
    expect(resolvePlayerSlotNickname(0, '本家', store.getNicknames(), 'Player 1')).toBe('本家');
    expect(resolvePlayerSlotNickname(3, '本家', store.getNicknames(), 'Player 4')).toBe('小红');
  });
  it('persists three independent slots without storing Player 1 or image payloads', () => {
    const storage = memory();
    const store = createPlayerSlotAvatarStore(storage);
    store.select(1, 'tile-m1'); store.select(2, 'custom:shared-image'); store.select(3, 'custom:shared-image');
    const reloaded = createPlayerSlotAvatarStore(storage).getSnapshot();
    expect(reloaded).toEqual({ 1: 'tile-m1', 2: 'custom:shared-image', 3: 'custom:shared-image' });
    expect(reloaded).not.toHaveProperty('0');
    for (const id of [3, 0, 2, 1]) {
      expect(resolvePlayerSlotAvatar(id, 'tile-p1', reloaded)).toBe(id === 0 ? 'tile-p1' : reloaded[id as 1 | 2 | 3]);
    }
  });
  it('clears all users of a deleted asset, leaving unrelated selections alone', () => {
    const storage = memory(); const store = createPlayerSlotAvatarStore(storage);
    store.select(1, 'custom:shared'); store.select(2, 'custom:shared'); store.select(3, 'tile-m1');
    store.removeAsset('shared');
    expect(loadPlayerSlotAvatars(storage)).toEqual({ 1: DEFAULT_AVATAR_ID, 2: DEFAULT_AVATAR_ID, 3: 'tile-m1' });
  });
  it('falls back for malformed/future data and invalid avatar IDs', () => {
    const storage = memory();
    for (const raw of ['{', 'null', '{"version":99,"avatars":{"1":"tile-m1"}}']) {
      storage.setItem(PLAYER_SLOT_AVATARS_KEY, raw);
      expect(loadPlayerSlotAvatars(storage)[1]).toBe(DEFAULT_AVATAR_ID);
    }
    storage.setItem(PLAYER_SLOT_AVATARS_KEY, JSON.stringify({ version: 1, avatars: { 1: 'bad', 2: 'tile-m1' } }));
    expect(loadPlayerSlotAvatars(storage)).toEqual({ 1: DEFAULT_AVATAR_ID, 2: 'tile-m1', 3: DEFAULT_AVATAR_ID });
  });
  it('notifies subscribers and refuses deletion when persistence fails', () => {
    const storage = memory(); const store = createPlayerSlotAvatarStore(storage);
    let changes = 0; const release = store.subscribe(() => changes++);
    store.select(1, 'custom:shared');
    storage.setItem = () => { throw new Error('quota'); };
    expect(() => store.removeAsset('shared')).toThrow('quota');
    expect(store.getSnapshot()[1]).toBe('custom:shared'); expect(changes).toBe(1); release();
  });
});

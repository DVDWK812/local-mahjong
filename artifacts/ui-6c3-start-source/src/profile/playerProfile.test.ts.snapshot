import { describe, expect, it } from 'vitest';
import { createCustomAvatarId, getAvatarDefinition, getCustomAvatarAssetId, type BuiltinAvatarId } from './avatars';
import { DEFAULT_PLAYER_PROFILE, PLAYER_NICKNAME_MAX_LENGTH, normalizePlayerProfile } from './playerProfile';

describe('PlayerProfile', () => {
  it('缺失或非法值回退到稳定默认资料', () => {
    expect(normalizePlayerProfile(null)).toEqual(DEFAULT_PLAYER_PROFILE);
    expect(normalizePlayerProfile([])).toEqual(DEFAULT_PLAYER_PROFILE);
    expect(normalizePlayerProfile({ nickname: '', avatarId: 'not-exist' })).toEqual(DEFAULT_PLAYER_PROFILE);
    expect(normalizePlayerProfile({ nickname: '   ', avatarId: 'avatar-02' })).toEqual({
      nickname: DEFAULT_PLAYER_PROFILE.nickname,
      avatarId: 'avatar-02',
    });
  });

  it('昵称去除首尾空格，并按 Unicode 码点限制长度', () => {
    expect(normalizePlayerProfile({ nickname: '  Wenkai  ', avatarId: 'avatar-03' })).toEqual({
      nickname: 'Wenkai',
      avatarId: 'avatar-03',
    });
    expect(normalizePlayerProfile({ nickname: '🀄玩家1234567890', avatarId: 'avatar-01' }).nickname)
      .toBe(Array.from('🀄玩家1234567890').slice(0, PLAYER_NICKNAME_MAX_LENGTH).join(''));
  });

  it('UI-1A 的四个旧头像 id 继续有效', () => {
    const legacyIds = ['avatar-01', 'avatar-02', 'avatar-03', 'avatar-04'] as const satisfies readonly BuiltinAvatarId[];
    for (const avatarId of legacyIds) {
      expect(normalizePlayerProfile({ nickname: '旧玩家', avatarId }).avatarId).toBe(avatarId);
      expect(getAvatarDefinition(avatarId).id).toBe(avatarId);
    }
  });

  it('custom avatar selection stays in PlayerProfile using a local asset reference', () => {
    const avatarId = createCustomAvatarId('appearance-avatar-1');
    expect(normalizePlayerProfile({ nickname: '自定义', avatarId }).avatarId).toBe(avatarId);
    expect(getCustomAvatarAssetId(avatarId)).toBe('appearance-avatar-1');
    expect(normalizePlayerProfile({ nickname: '自定义', avatarId: 'custom:../bad' }).avatarId).toBe(DEFAULT_PLAYER_PROFILE.avatarId);
  });
});

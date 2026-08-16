import { DEFAULT_AVATAR_ID, isAvatarId, type AvatarId } from './avatars';

export interface PlayerProfile {
  nickname: string;
  avatarId: AvatarId;
}

export const PLAYER_NICKNAME_MAX_LENGTH = 12;
export const DEFAULT_PLAYER_PROFILE: Readonly<PlayerProfile> = Object.freeze({
  nickname: '玩家',
  avatarId: DEFAULT_AVATAR_ID,
});

export function nicknameLength(value: string): number {
  return Array.from(value).length;
}

export function limitNicknameInput(value: string): string {
  return Array.from(value).slice(0, PLAYER_NICKNAME_MAX_LENGTH).join('');
}

export function normalizeNickname(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const nickname = limitNicknameInput(value.trim());
  return nickname ? nickname : null;
}

export function normalizePlayerProfile(value: unknown): PlayerProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_PLAYER_PROFILE };
  }
  const candidate = value as Partial<PlayerProfile>;
  return {
    nickname: normalizeNickname(candidate.nickname) ?? DEFAULT_PLAYER_PROFILE.nickname,
    avatarId: isAvatarId(candidate.avatarId) ? candidate.avatarId : DEFAULT_PLAYER_PROFILE.avatarId,
  };
}

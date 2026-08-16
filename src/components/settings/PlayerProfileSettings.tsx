import { useEffect, useState } from 'react';
import type { AvatarCategoryFilter } from '../../profile/avatars';
import {
  PLAYER_NICKNAME_MAX_LENGTH,
  limitNicknameInput,
  nicknameLength,
  normalizeNickname,
  type PlayerProfile,
} from '../../profile/playerProfile';
import { AvatarPicker } from './AvatarPicker';

interface PlayerProfileSettingsProps {
  profile: PlayerProfile;
  onChange: (profile: PlayerProfile) => void;
}

export function PlayerProfileSettings({ profile, onChange }: PlayerProfileSettingsProps) {
  const [nicknameDraft, setNicknameDraft] = useState(profile.nickname);
  const [avatarCategory, setAvatarCategory] = useState<AvatarCategoryFilter>('all');

  useEffect(() => {
    setNicknameDraft(profile.nickname);
  }, [profile.nickname]);

  const handleNicknameChange = (value: string) => {
    const limited = limitNicknameInput(value);
    setNicknameDraft(limited);
    const nickname = normalizeNickname(limited);
    if (nickname && nickname !== profile.nickname) onChange({ ...profile, nickname });
  };

  return (
    <section className="settings-block player-profile-settings" aria-labelledby="player-profile-settings-title">
      <h3 id="player-profile-settings-title">玩家资料</h3>
      <div className="player-profile-settings__layout">
        <label className="settings-field player-profile-settings__nickname">
          <span>昵称</span>
          <input
            type="text"
            aria-label="玩家昵称"
            aria-describedby="player-profile-nickname-help"
            autoComplete="nickname"
            value={nicknameDraft}
            onChange={(event) => handleNicknameChange(event.target.value)}
            onBlur={() => setNicknameDraft(profile.nickname)}
          />
          <small id="player-profile-nickname-help">
            去除首尾空格，最多 {PLAYER_NICKNAME_MAX_LENGTH} 个 Unicode 码点（{nicknameLength(nicknameDraft.trim())}/{PLAYER_NICKNAME_MAX_LENGTH}）
          </small>
        </label>
        <fieldset className="player-profile-settings__avatars">
          <legend>头像</legend>
          <AvatarPicker
            category={avatarCategory}
            selectedAvatarId={profile.avatarId}
            onCategoryChange={setAvatarCategory}
            onSelect={(avatarId) => onChange({ ...profile, avatarId })}
          />
        </fieldset>
      </div>
    </section>
  );
}

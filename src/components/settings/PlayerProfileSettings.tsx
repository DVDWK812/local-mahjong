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
import { PlayerSlotAppearanceSettings } from './PlayerSlotAppearanceSettings';
import type { AppearanceSettings } from '../../presentation/appearance/appearanceSettings';
import { playerSlotAvatarStore, usePlayerSlotAvatars, usePlayerSlotNicknames, type OpponentSlot } from '../../presentation/appearance/playerSlotAvatars';

interface PlayerProfileSettingsProps {
  appearanceSettings?: AppearanceSettings;
  profile: PlayerProfile;
  onChange: (profile: PlayerProfile) => void;
  onDeleteAsset?: (assetId: string) => Promise<void>;
}

export function PlayerProfileSettings({ profile, onChange, onDeleteAsset, appearanceSettings }: PlayerProfileSettingsProps) {
  const [nicknameDraft, setNicknameDraft] = useState(profile.nickname);
  const [avatarCategory, setAvatarCategory] = useState<AvatarCategoryFilter>('all');
  const [slot, setSlot] = useState<0 | OpponentSlot>(0);
  const avatars = usePlayerSlotAvatars();
  const nicknames = usePlayerSlotNicknames();
  const savedNickname = slot === 0 ? profile.nickname : nicknames[slot];
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNicknameDraft(savedNickname);
  }, [savedNickname, slot]);

  const handleNicknameChange = (value: string) => {
    const limited = limitNicknameInput(value);
    setNicknameDraft(limited);
    const nickname = normalizeNickname(limited);
    if (!nickname || nickname === savedNickname) return;
    try {
      if (slot === 0) onChange({ ...profile, nickname });
      else playerSlotAvatarStore.setNickname(slot, nickname);
      setError(null);
    } catch { setError('昵称未能保存，请检查本机存储后重试。'); }
  };

  return (
    <section className="settings-block player-profile-settings" aria-label="玩家头像设置">
      <div className="avatar-category-tabs" role="tablist" aria-label="玩家设置导航">
        {([0, 1, 2, 3] as const).map(id => <button key={id} type="button" role="tab"
          className={`avatar-category-tab ${slot === id ? 'avatar-category-tab--active' : ''}`}
          id={`player-settings-tab-${id}`} aria-controls="player-settings-panel" aria-selected={slot === id}
          onClick={() => { setSlot(id); setError(null); }}>{id === 0 ? '玩家资料' : `Player ${id + 1}`}</button>)}
      </div>
      <div id="player-settings-panel" role="tabpanel" aria-labelledby={`player-settings-tab-${slot}`}>
      <div className="player-profile-settings__layout">
        <label className="settings-field player-profile-settings__nickname">
          <span>昵称</span>
          <input
            type="text"
            aria-label={slot === 0 ? '玩家昵称' : `Player ${slot + 1} 昵称`}
            aria-describedby="player-profile-nickname-help"
            autoComplete="nickname"
            value={nicknameDraft}
            onChange={(event) => handleNicknameChange(event.target.value)}
            onBlur={() => setNicknameDraft(savedNickname)}
          />
          <small id="player-profile-nickname-help">
            去除首尾空格，最多 {PLAYER_NICKNAME_MAX_LENGTH} 个 Unicode 码点（{nicknameLength(nicknameDraft.trim())}/{PLAYER_NICKNAME_MAX_LENGTH}）
          </small>
        </label>
        <fieldset className="player-profile-settings__avatars">
          <legend>头像</legend>
          <AvatarPicker
            key={slot}
            category={avatarCategory}
            selectedAvatarId={slot === 0 ? profile.avatarId : avatars[slot]}
            onCategoryChange={setAvatarCategory}
            onSelect={(avatarId) => {
              try {
                if (slot === 0) onChange({ ...profile, avatarId });
                else playerSlotAvatarStore.select(slot, avatarId);
                setError(null);
              } catch { setError('头像设置未能保存，请检查本机存储后重试。'); }
            }}
            onDeleteAsset={onDeleteAsset}
          />
        </fieldset>
        <PlayerSlotAppearanceSettings key={`appearance-${slot}`} slot={slot} global={appearanceSettings} onDeleteAsset={onDeleteAsset} />
      </div>
      {error ? <p role="alert">{error}</p> : null}
      </div>
    </section>
  );
}

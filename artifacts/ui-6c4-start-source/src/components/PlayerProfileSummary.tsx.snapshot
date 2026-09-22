import type { PlayerProfile } from '../profile/playerProfile';
import { PlayerAvatar } from './PlayerAvatar';

interface PlayerProfileSummaryProps {
  profile: PlayerProfile;
  onOpenSettings: () => void;
  onOpenAppearanceSettings?: () => void;
  onOpenAudioSettings?: () => void;
}

export function PlayerProfileSummary({ profile, onOpenSettings, onOpenAppearanceSettings = () => undefined, onOpenAudioSettings = () => undefined }: PlayerProfileSummaryProps) {
  return (
    <section className="home-player-profile" aria-label="玩家资料">
      <div className="home-player-profile__identity">
        <PlayerAvatar avatarId={profile.avatarId} className="home-player-profile__avatar" />
        <strong title={profile.nickname}>{profile.nickname}</strong>
      </div>
      <div className="home-player-profile__actions">
        <button type="button" aria-label="玩家设置" onClick={onOpenSettings}>
          玩家设置 <span aria-hidden="true">›</span>
        </button>
        <button type="button" aria-label="图像设置" onClick={onOpenAppearanceSettings}>
          图像设置 <span aria-hidden="true">›</span>
        </button>
        <button type="button" aria-label="音频设置" onClick={onOpenAudioSettings}>
          音频设置 <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
}

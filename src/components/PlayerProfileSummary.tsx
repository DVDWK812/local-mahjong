import type { PlayerProfile } from '../profile/playerProfile';
import { PlayerAvatar } from './PlayerAvatar';

interface PlayerProfileSummaryProps {
  profile: PlayerProfile;
  onOpenSettings: () => void;
  onOpenAudioSettings?: () => void;
}

export function PlayerProfileSummary({ profile, onOpenSettings, onOpenAudioSettings = () => undefined }: PlayerProfileSummaryProps) {
  return (
    <section className="home-player-profile" aria-label="当前玩家">
      <PlayerAvatar avatarId={profile.avatarId} className="home-player-profile__avatar" />
      <div className="home-player-profile__identity">
        <span>当前玩家</span>
        <strong title={profile.nickname}>{profile.nickname}</strong>
      </div>
      <div className="home-player-profile__actions">
        <button type="button" aria-label="玩家设置" onClick={onOpenSettings}>
          玩家设置 <span aria-hidden="true">›</span>
        </button>
        <button type="button" aria-label="音频设置" onClick={onOpenAudioSettings}>
          音频设置 <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
}

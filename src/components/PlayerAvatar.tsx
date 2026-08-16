import { getAvatarDefinition, type AvatarId } from '../profile/avatars';
import { getTileAltById, getTileImageById } from '../game/tileAssets';

interface PlayerAvatarProps {
  avatarId: AvatarId;
  className?: string;
}

export function PlayerAvatar({ avatarId, className = '' }: PlayerAvatarProps) {
  const avatar = getAvatarDefinition(avatarId);
  return (
    <span className={`player-avatar ${avatar.className} ${className}`.trim()} aria-hidden="true">
      {avatar.kind === 'tile' ? (
        <img
          className="player-avatar__tile-image"
          src={getTileImageById(avatar.tileId)}
          alt={getTileAltById(avatar.tileId)}
          draggable={false}
        />
      ) : avatar.kind === 'image' ? (
        <img
          className="player-avatar__image"
          src={avatar.src}
          alt=""
          draggable={false}
        />
      ) : (
        <span className="player-avatar__glyph">{avatar.glyph}</span>
      )}
    </span>
  );
}

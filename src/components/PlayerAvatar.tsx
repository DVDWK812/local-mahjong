import { useMemo, useState } from 'react';
import {
  DEFAULT_AVATAR_ID,
  getAvatarDefinition,
  getCustomAvatarAssetId,
  isBuiltinAvatarId,
  type AvatarId,
  type BuiltinAvatarId,
} from '../profile/avatars';
import { useAppearanceAssetSource } from '../presentation/appearance/appearanceAssetResolver';
import { getTileAltById, getTileImageById } from '../game/tileAssets';

interface PlayerAvatarProps {
  avatarId: AvatarId;
  className?: string;
}

function BuiltinPlayerAvatar({ avatarId, className = '' }: { avatarId: BuiltinAvatarId; className?: string }) {
  const avatar = getAvatarDefinition(avatarId);
  return (
    <span className={`player-avatar ${avatar.className} ${className}`.trim()} aria-hidden="true">
      {avatar.kind === 'tile' ? (
        <img className="player-avatar__tile-image" src={getTileImageById(avatar.tileId)} alt={getTileAltById(avatar.tileId)} draggable={false} />
      ) : avatar.kind === 'image' ? (
        <img className="player-avatar__image" src={avatar.src} alt="" draggable={false} />
      ) : <span className="player-avatar__glyph">{avatar.glyph}</span>}
    </span>
  );
}

function CustomPlayerAvatar({ assetId, className }: { assetId: string; className: string }) {
  const reference = useMemo(() => ({ kind: 'local' as const, assetId }), [assetId]);
  const source = useAppearanceAssetSource(reference, '');
  const [failedSource, setFailedSource] = useState('');
  if (!source || source === failedSource) return <BuiltinPlayerAvatar avatarId={DEFAULT_AVATAR_ID} className={className} />;
  return (
    <span className={`player-avatar player-avatar--custom ${className}`.trim()} aria-hidden="true">
      <img className="player-avatar__image" src={source} alt="" draggable={false} onError={() => setFailedSource(source)} />
    </span>
  );
}

/** Resolves builtin and IndexedDB-backed custom avatars without changing profile ownership. */
export function PlayerAvatar({ avatarId, className = '' }: PlayerAvatarProps) {
  const assetId = getCustomAvatarAssetId(avatarId);
  return assetId
    ? <CustomPlayerAvatar assetId={assetId} className={className} />
    : <BuiltinPlayerAvatar avatarId={isBuiltinAvatarId(avatarId) ? avatarId : DEFAULT_AVATAR_ID} className={className} />;
}

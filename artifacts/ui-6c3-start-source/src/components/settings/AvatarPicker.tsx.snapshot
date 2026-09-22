import { useState } from 'react';
import {
  AVATAR_CATEGORY_TABS,
  avatarsForCategory,
  DEFAULT_AVATAR_ID,
  createCustomAvatarId,
  getCustomAvatarAssetId,
  type AvatarCategoryFilter,
  type AvatarId,
} from '../../profile/avatars';
import { PlayerAvatar } from '../PlayerAvatar';
import { AppearanceImageLibrary } from './AppearanceImageLibrary';

interface AvatarPickerProps {
  category: AvatarCategoryFilter;
  selectedAvatarId: AvatarId;
  onCategoryChange: (category: AvatarCategoryFilter) => void;
  onSelect: (avatarId: AvatarId) => void;
  onDeleteAsset?: (assetId: string) => Promise<void>;
}

export function AvatarPicker({ category, selectedAvatarId, onCategoryChange, onSelect, onDeleteAsset }: AvatarPickerProps) {
  const visibleAvatars = avatarsForCategory(category);
  const [customOpen, setCustomOpen] = useState(false);
  const customAvatarAssetId = getCustomAvatarAssetId(selectedAvatarId);

  return (
    <div className="avatar-picker">
      <div className="avatar-picker__toolbar">
        <div className="avatar-category-tabs" role="tablist" aria-label="头像分类">
          {AVATAR_CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              id={`avatar-category-tab-${tab.id}`}
              type="button"
              role="tab"
              className={`avatar-category-tab ${!customOpen && category === tab.id ? 'avatar-category-tab--active' : ''}`}
              aria-controls="avatar-category-panel"
              aria-selected={!customOpen && category === tab.id}
              onClick={() => { setCustomOpen(false); onCategoryChange(tab.id); }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="avatar-picker__custom">
          <button
            type="button"
            className="avatar-picker__custom-button"
            aria-pressed={customOpen}
            onClick={() => setCustomOpen(true)}
          >
            自定义头像
          </button>
          {customAvatarAssetId ? (
            <span className="avatar-picker__custom-preview" role="status">
              <PlayerAvatar avatarId={selectedAvatarId} />
              已使用自定义头像
            </span>
          ) : null}
        </div>
      </div>
      <div
        id="avatar-category-panel"
        className="avatar-picker-scroll"
        role="tabpanel"
        aria-label={customOpen ? '自定义头像图库' : undefined}
        aria-labelledby={customOpen ? undefined : `avatar-category-tab-${category}`}
      >
        {customOpen ? <AppearanceImageLibrary scope={{ kind: 'avatar' }} label="头像" aspectRatio={3 / 4} addLabel="添加新头像"
          selected={customAvatarAssetId ? { kind: 'local', assetId: customAvatarAssetId } : { kind: 'builtin', id: selectedAvatarId }}
          defaultRef={{ kind: 'builtin', id: DEFAULT_AVATAR_ID }} defaultPreview={<PlayerAvatar avatarId={DEFAULT_AVATAR_ID} />}
          onSelect={(ref) => onSelect(ref.kind === 'local' ? createCustomAvatarId(ref.assetId) : DEFAULT_AVATAR_ID)} onDeleteAsset={onDeleteAsset}
        /> : (
        <div className="avatar-grid">
          {visibleAvatars.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              className={`avatar-option ${selectedAvatarId === avatar.id ? 'avatar-option--selected' : ''}`}
              aria-label={`选择头像：${avatar.label}`}
              aria-pressed={selectedAvatarId === avatar.id}
              onClick={() => onSelect(avatar.id)}
            >
              <PlayerAvatar avatarId={avatar.id} />
              <span>{avatar.label}</span>
            </button>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

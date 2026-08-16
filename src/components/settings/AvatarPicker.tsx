import { useState } from 'react';
import {
  AVATAR_CATEGORY_TABS,
  avatarsForCategory,
  type AvatarCategoryFilter,
  type AvatarId,
} from '../../profile/avatars';
import { PlayerAvatar } from '../PlayerAvatar';

interface AvatarPickerProps {
  category: AvatarCategoryFilter;
  selectedAvatarId: AvatarId;
  onCategoryChange: (category: AvatarCategoryFilter) => void;
  onSelect: (avatarId: AvatarId) => void;
}

export function AvatarPicker({ category, selectedAvatarId, onCategoryChange, onSelect }: AvatarPickerProps) {
  const visibleAvatars = avatarsForCategory(category);
  const [customAvatarNotice, setCustomAvatarNotice] = useState(false);

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
              className={`avatar-category-tab ${category === tab.id ? 'avatar-category-tab--active' : ''}`}
              aria-controls="avatar-category-panel"
              aria-selected={category === tab.id}
              onClick={() => onCategoryChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="avatar-picker__custom">
          <button
            type="button"
            className="avatar-picker__custom-button"
            onClick={() => setCustomAvatarNotice(true)}
          >
            自定义头像
          </button>
          {customAvatarNotice && <span role="status">暂未开放</span>}
        </div>
      </div>
      <div
        id="avatar-category-panel"
        className="avatar-picker-scroll"
        role="tabpanel"
        aria-labelledby={`avatar-category-tab-${category}`}
      >
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
      </div>
    </div>
  );
}

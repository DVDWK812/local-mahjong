import { useSyncExternalStore } from 'react';
import {
  getAvatarFrameTuningRevision,
  resetAvatarFrameBaseSize,
  setAvatarFrameBaseSize,
  subscribeAvatarFrameTuning,
  TABLE_PRESENTATION_TUNING,
} from './tablePresentationTuning';

/**
 * Development-only control exposed by the 3D technical sample query. It edits
 * the single presentation tuning authority and intentionally has no settings,
 * profile, or persistence dependency.
 */
export function AvatarFrameTuningPanel() {
  useSyncExternalStore(
    subscribeAvatarFrameTuning,
    getAvatarFrameTuningRevision,
    getAvatarFrameTuningRevision,
  );
  const size = TABLE_PRESENTATION_TUNING.avatarFrame.size;
  return (
    <aside className="avatar-frame-tuning-panel" role="dialog" aria-label="Avatar Frame 开发调参">
      <strong>Avatar Frame</strong>
      <label htmlFor="avatar-frame-base-size">基础尺寸 {size.toFixed(2)}</label>
      <input
        id="avatar-frame-base-size"
        type="range"
        min="0.6"
        max="1.8"
        step="0.02"
        value={size}
        onChange={(event) => setAvatarFrameBaseSize(Number(event.currentTarget.value))}
      />
      <p>统一 3:4 框；四席位置不变，仍按响应式缩放。</p>
      <button type="button" onClick={resetAvatarFrameBaseSize}>恢复 1.10</button>
    </aside>
  );
}

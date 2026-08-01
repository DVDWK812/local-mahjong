import { useState } from 'react';
import {
  RESOLUTION_PRESETS,
  type AppSettingsV1,
  type ResolutionPreset,
} from '../app/appSettings';
import { useAppResolutionViewport } from './layout/AppResolutionViewport';

export type SettingsCategory = 'sound' | 'resolution' | 'language' | 'preference' | 'avatar' | 'other';

const SETTINGS_CATEGORIES: ReadonlyArray<{ id: SettingsCategory; label: string }> = [
  { id: 'sound', label: '声音' },
  { id: 'resolution', label: '画面分辨率' },
  { id: 'language', label: '语言' },
  { id: 'preference', label: '偏好' },
  { id: 'avatar', label: '形象' },
  { id: 'other', label: '其他' },
];

interface SettingsScreenProps {
  settings: AppSettingsV1;
  notice?: string | null;
  initialCategory?: SettingsCategory;
  onResolutionPresetChange: (preset: ResolutionPreset) => void;
  onBack: () => void;
}

export function SettingsScreen({
  settings,
  notice = null,
  initialCategory = 'resolution',
  onResolutionPresetChange,
  onBack,
}: SettingsScreenProps) {
  const [category, setCategory] = useState<SettingsCategory>(initialCategory);
  const selected = SETTINGS_CATEGORIES.find((entry) => entry.id === category)!;
  const resolution = useAppResolutionViewport();
  const selectedConfig = RESOLUTION_PRESETS[settings.resolutionPreset];
  const preferredSize = selectedConfig.width && selectedConfig.height
    ? `${selectedConfig.width} × ${selectedConfig.height}`
    : '根据当前窗口';

  return (
    <main className="app-settings-page" aria-labelledby="app-settings-title">
        <section className="app-settings-panel">
          <header className="app-settings-header">
            <div>
              <p className="menu-path">主菜单 ＞ 设置</p>
              <h1 id="app-settings-title">设置</h1>
            </div>
            <button type="button" className="back-button" onClick={onBack}>返回主菜单</button>
          </header>
          {notice ? <p className="menu-notice" role="status">{notice}</p> : null}
          <div className="app-settings-layout">
            <nav className="app-settings-categories" aria-label="设置分类">
              {SETTINGS_CATEGORIES.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  aria-current={entry.id === category ? 'page' : undefined}
                  onClick={() => setCategory(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </nav>
            <section className="app-settings-content" aria-labelledby="app-settings-category-title">
              <h2 id="app-settings-category-title">{selected.label}</h2>
              {category === 'resolution' ? (
                <label className="app-settings-field">
                  <span>首选分辨率</span>
                  <select
                    aria-label="首选分辨率"
                    value={settings.resolutionPreset}
                    onChange={(event) => onResolutionPresetChange(event.target.value as ResolutionPreset)}
                  >
                    {(Object.entries(RESOLUTION_PRESETS) as Array<[ResolutionPreset, typeof RESOLUTION_PRESETS[ResolutionPreset]]>).map(([value, preset]) => (
                      <option key={value} value={value}>
                        {preset.width && preset.height ? `${preset.label}（${preset.width} × ${preset.height}）` : `${preset.label}（根据窗口）`}
                      </option>
                    ))}
                  </select>
                  <small>浏览器版本会根据当前窗口自动适配。分辨率预设将用于显示偏好和未来桌面客户端。</small>
                  <dl className="app-settings-resolution-status">
                    <div><dt>当前预设</dt><dd>{selectedConfig.label}</dd></div>
                    <div><dt>偏好尺寸</dt><dd>{preferredSize}</dd></div>
                    <div><dt>当前窗口尺寸</dt><dd>{Math.round(resolution.viewport.width)} × {Math.round(resolution.viewport.height)}</dd></div>
                    <div><dt>布局方式</dt><dd>实际视口自动适配</dd></div>
                  </dl>
                </label>
              ) : (
                <p className="app-settings-coming-soon">功能开发中</p>
              )}
            </section>
          </div>
        </section>
    </main>
  );
}

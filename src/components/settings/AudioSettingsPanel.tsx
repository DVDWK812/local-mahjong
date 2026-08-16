import { audioVolumePercent, type AudioSettings } from '../../audio/audioSettings';

interface AudioSettingsPanelProps {
  settings: AudioSettings;
  onChange: (settings: AudioSettings) => void;
}

type VolumeKey = 'masterVolume' | 'bgmVolume' | 'sfxVolume' | 'voiceVolume';
type ToggleKey = 'bgmEnabled' | 'sfxEnabled' | 'voiceEnabled' | 'riichiMusicEnabled';

export function AudioSettingsPanel({ settings, onChange }: AudioSettingsPanelProps) {
  const updateVolume = (key: VolumeKey, value: string) => {
    onChange({ ...settings, [key]: Number(value) / 100 });
  };
  const updateToggle = (key: ToggleKey, checked: boolean) => {
    onChange({ ...settings, [key]: checked });
  };

  return (
    <section className="audio-settings" aria-labelledby="audio-settings-panel-title">
      <h3 id="audio-settings-panel-title">音量与播放</h3>
      <VolumeSlider
        label="总音量"
        value={settings.masterVolume}
        onChange={(value) => updateVolume('masterVolume', value)}
      />

      <fieldset className="audio-settings__channel">
        <legend>背景音乐</legend>
        <AudioToggle
          label="背景音乐"
          checked={settings.bgmEnabled}
          onChange={(checked) => updateToggle('bgmEnabled', checked)}
        />
        <VolumeSlider
          label="背景音乐音量"
          value={settings.bgmVolume}
          disabled={!settings.bgmEnabled}
          onChange={(value) => updateVolume('bgmVolume', value)}
        />
        <AudioToggle
          label="立直音乐"
          checked={settings.riichiMusicEnabled}
          onChange={(checked) => updateToggle('riichiMusicEnabled', checked)}
        />
      </fieldset>

      <fieldset className="audio-settings__channel">
        <legend>游戏音效</legend>
        <AudioToggle
          label="游戏音效"
          checked={settings.sfxEnabled}
          onChange={(checked) => updateToggle('sfxEnabled', checked)}
        />
        <VolumeSlider
          label="游戏音效音量"
          value={settings.sfxVolume}
          disabled={!settings.sfxEnabled}
          onChange={(value) => updateVolume('sfxVolume', value)}
        />
      </fieldset>

      <fieldset className="audio-settings__channel">
        <legend>语音</legend>
        <AudioToggle
          label="语音"
          checked={settings.voiceEnabled}
          onChange={(checked) => updateToggle('voiceEnabled', checked)}
        />
        <VolumeSlider
          label="语音音量"
          value={settings.voiceVolume}
          disabled={!settings.voiceEnabled}
          onChange={(value) => updateVolume('voiceVolume', value)}
        />
      </fieldset>
    </section>
  );
}

interface VolumeSliderProps {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function VolumeSlider({ label, value, disabled = false, onChange }: VolumeSliderProps) {
  const percent = audioVolumePercent(value);
  return (
    <label className={`audio-volume ${disabled ? 'audio-volume--disabled' : ''}`}>
      <span>
        <strong>{label}</strong>
        <output>{percent}%</output>
      </span>
      <input
        type="range"
        aria-label={label}
        min="0"
        max="100"
        step="1"
        value={percent}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface AudioToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function AudioToggle({ label, checked, onChange }: AudioToggleProps) {
  return (
    <label className="settings-check audio-settings__toggle">
      <input
        type="checkbox"
        aria-label={`${label}开关`}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
      <strong>{checked ? '开启' : '关闭'}</strong>
    </label>
  );
}

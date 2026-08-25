import { useRef, useState } from 'react';
import { audioVolumePercent, type AudioSettings } from '../../audio/audioSettings';
import type { PlaybackSnapshot } from '../../audio/AudioManager';
import { supportsFileSystemAccess, type LinkedTrackStatus, type MusicLibraryUi } from '../../audio/musicLibrary';
import type { GameSfxGroup, MusicCategory, MusicTrackDefinition, MusicTrackId, PlaybackMode } from '../../audio/musicTypes';
import { VoicePackSettings } from './VoicePackSettings';
import type { VoicePackSummary } from '../../audio/voice/types';
import type { VoiceSeatAssignments } from '../../audio/voice/voicePreferences';

interface AudioSettingsPanelProps {
  settings: AudioSettings;
  onChange: (settings: AudioSettings) => void;
  library: MusicLibraryUi;
  playback: PlaybackSnapshot;
  previewTrackId: MusicTrackId | null;
  notice: string | null;
  onAddLinked: (category: MusicCategory, gameSfxGroup?: GameSfxGroup) => void;
  onAddCopied: (category: MusicCategory, gameSfxGroup: GameSfxGroup | undefined, files: FileList) => void;
  onRemoveTrack: (category: MusicCategory, trackId: MusicTrackId) => void;
  onReauthorize: (category: MusicCategory, trackId: MusicTrackId) => void;
  onRelink: (category: MusicCategory, trackId: MusicTrackId) => void;
  onReorder: (category: MusicCategory, orderedIds: MusicTrackId[]) => void;
  onReorderSfxGroup: (group: GameSfxGroup, orderedIds: MusicTrackId[]) => void;
  onSfxPlaybackModeChange: (group: GameSfxGroup, mode: PlaybackMode) => void;
  onPlaybackModeChange: (category: MusicCategory, mode: PlaybackMode) => void;
  onPreview: (track: MusicTrackDefinition) => void;
  onStopPreview: () => void;
  onTogglePlayback: () => void;
  onSeekPlayback: (time: number) => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onManageVoicePack: (packId: string) => void;
  onCreateVoicePack: () => void;
  voicePlayerCount: 2 | 3 | 4;
  onVoicePackDeleted?: (deletedPackId: string, remainingPacks: readonly VoicePackSummary[]) => void;
}

interface MusicCategoryCardConfig {
  readonly category: MusicCategory;
  readonly title: string;
  readonly volumeKey: 'bgmVolume' | 'bgmGameVolume' | 'bgmRiichiVolume' | 'sfxVolume';
  readonly enabledKey: 'bgmEnabled' | 'bgmGameEnabled' | 'riichiMusicEnabled' | 'sfxEnabled';
}

const MANAGED_CATEGORIES: readonly MusicCategoryCardConfig[] = Object.freeze([
  { category: 'bgm_main', title: '背景音乐', volumeKey: 'bgmVolume', enabledKey: 'bgmEnabled' },
  { category: 'bgm_game', title: '游戏音乐', volumeKey: 'bgmGameVolume', enabledKey: 'bgmGameEnabled' },
  { category: 'bgm_richi', title: '立直音乐', volumeKey: 'bgmRiichiVolume', enabledKey: 'riichiMusicEnabled' },
  { category: 'effects', title: '游戏音效', volumeKey: 'sfxVolume', enabledKey: 'sfxEnabled' },
]);

const PLAYBACK_MODE_LABELS: Record<PlaybackMode, string> = {
  shuffle: '随机播放',
  sequential: '循环播放',
  'repeat-one': '单曲循环',
};

export function AudioSettingsPanel({
  settings,
  onChange,
  library,
  playback,
  previewTrackId,
  notice,
  onAddLinked,
  onAddCopied,
  onRemoveTrack,
  onReauthorize,
  onRelink,
  onReorder,
  onReorderSfxGroup,
  onSfxPlaybackModeChange,
  onPlaybackModeChange,
  onPreview,
  onStopPreview,
  onTogglePlayback,
  onSeekPlayback,
  onPreviousTrack,
  onNextTrack,
  onManageVoicePack,
  onCreateVoicePack,
  voicePlayerCount,
  onVoicePackDeleted,
}: AudioSettingsPanelProps) {
  return (
    <section className="audio-settings" aria-labelledby="audio-settings-panel-title">
      <h3 id="audio-settings-panel-title">音量与播放</h3>
      {notice ? (
        <p className="music-library-notice" role="status">{notice}</p>
      ) : null}
      <CurrentPlayer
        playback={playback}
        onTogglePlayback={onTogglePlayback}
        onSeekPlayback={onSeekPlayback}
        onPreviousTrack={onPreviousTrack}
        onNextTrack={onNextTrack}
      />
      <p className="music-library-hint">
        外部音乐默认引用原文件，不会复制到游戏存储中。移动、删除或失去源文件访问权限后，曲目可能无法播放。需要长期保留时，可选择复制到游戏音乐库。
      </p>
      <MasterVolumeControl
        value={settings.masterVolume}
        enabled={settings.masterEnabled}
        onChange={(patch) => onChange({ ...settings, ...patch })}
      />

      {MANAGED_CATEGORIES.map((config) => (
        config.category === 'effects' ? (
          <SfxCategoryCard
            key={config.category}
            config={config}
            settings={settings}
            onChange={onChange}
            library={library}
            previewTrackId={previewTrackId}
            onAddLinked={onAddLinked}
            onAddCopied={onAddCopied}
            onRemoveTrack={onRemoveTrack}
            onReauthorize={onReauthorize}
            onRelink={onRelink}
            onReorderSfxGroup={onReorderSfxGroup}
            onSfxPlaybackModeChange={onSfxPlaybackModeChange}
            onPreview={onPreview}
            onStopPreview={onStopPreview}
          />
        ) : (
          <MusicCategoryCard
            key={config.category}
            config={config}
            settings={settings}
            onChange={onChange}
            library={library}
            previewTrackId={previewTrackId}
            onAddLinked={onAddLinked}
            onAddCopied={onAddCopied}
            onRemoveTrack={onRemoveTrack}
            onReauthorize={onReauthorize}
            onRelink={onRelink}
            onReorder={onReorder}
            onPlaybackModeChange={onPlaybackModeChange}
            onPreview={onPreview}
            onStopPreview={onStopPreview}
          />
        )
      ))}

      <fieldset className="audio-settings__channel audio-settings__channel--voice">
        <legend>语音</legend>
        <VoicePackSettings
          selectedVoicePackId={settings.selectedVoicePackId}
          onSelect={(selectedVoicePackId) => onChange({ ...settings, selectedVoicePackId })}
          onManage={onManageVoicePack}
          onCreate={onCreateVoicePack}
          voicePackBySeat={settings.voicePackBySeat}
          playerCount={voicePlayerCount}
          onSeatAssignmentChange={(seatIndex, packId) => onChange({ ...settings, voicePackBySeat: replaceVoiceSeatAssignment(settings.voicePackBySeat, seatIndex, packId) })}
          onDeleted={onVoicePackDeleted}
          controls={<><AudioToggle
            label="语音"
            checked={settings.voiceEnabled}
            onChange={(checked) => onChange({ ...settings, voiceEnabled: checked })}
          /><VolumeSlider
            label="语音音量"
            value={settings.voiceVolume}
            disabled={!settings.voiceEnabled}
            onChange={(value) => onChange({ ...settings, voiceVolume: Number(value) / 100 })}
          /><AudioToggle label="出牌报牌" checked={settings.discardVoiceEnabled} onChange={(discardVoiceEnabled) => onChange({ ...settings, discardVoiceEnabled })} /><label className="audio-settings__field">报牌范围<select aria-label="出牌报牌范围" disabled={!settings.discardVoiceEnabled} value={settings.discardVoiceScope} onChange={(event) => onChange({ ...settings, discardVoiceScope: event.target.value === 'self' ? 'self' : 'all' })}><option value="all">全部玩家</option><option value="self">仅自己</option></select></label></>}
        />
      </fieldset>
    </section>
  );
}

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

function CurrentPlayer({
  playback,
  onTogglePlayback,
  onSeekPlayback,
  onPreviousTrack,
  onNextTrack,
}: {
  playback: PlaybackSnapshot;
  onTogglePlayback: () => void;
  onSeekPlayback: (time: number) => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
}) {
  const hasTrack = playback.source !== null;
  const duration = Number.isFinite(playback.duration) && playback.duration > 0
    ? playback.duration
    : Number.NaN;
  const canSeek = hasTrack && Number.isFinite(duration) && duration > 0;
  const current = canSeek ? Math.min(playback.currentTime, duration) : 0;

  return (
    <div className="audio-settings__player">
      <p className="audio-settings__player-name">
        当前播放：<strong>{playback.trackName ?? '无'}</strong>
      </p>
      <div className="audio-settings__player-progress">
        <span className="audio-settings__player-time">{formatPlaybackTime(playback.currentTime)}</span>
        <input
          type="range"
          aria-label="播放进度"
          min="0"
          max={canSeek ? Math.floor(duration) : 0}
          step="1"
          value={current}
          disabled={!canSeek}
          onChange={(event) => onSeekPlayback(Number(event.target.value))}
        />
        <span className="audio-settings__player-time">{canSeek ? formatPlaybackTime(duration) : '--:--'}</span>
      </div>
      <div className="audio-settings__player-transport">
        <button type="button" aria-label="上一首" title="上一首" disabled={!hasTrack} onClick={onPreviousTrack}>⏮</button>
        <button type="button" aria-label={playback.isPlaying ? '暂停' : '播放'} title={playback.isPlaying ? '暂停' : '播放'} disabled={!hasTrack} onClick={onTogglePlayback}>{playback.isPlaying ? '⏸' : '▶'}</button>
        <button type="button" aria-label="下一首" title="下一首" disabled={!hasTrack} onClick={onNextTrack}>⏭</button>
      </div>
    </div>
  );
}

function MusicCategoryCard({
  config,
  settings,
  onChange,
  library,
  previewTrackId,
  onAddLinked,
  onAddCopied,
  onRemoveTrack,
  onReauthorize,
  onRelink,
  onReorder,
  onPlaybackModeChange,
  onPreview,
  onStopPreview,
}: {
  config: MusicCategoryCardConfig;
  settings: AudioSettings;
  onChange: (settings: AudioSettings) => void;
  library: MusicLibraryUi;
  previewTrackId: MusicTrackId | null;
  onAddLinked: (category: MusicCategory, gameSfxGroup?: GameSfxGroup) => void;
  onAddCopied: (category: MusicCategory, gameSfxGroup: GameSfxGroup | undefined, files: FileList) => void;
  onRemoveTrack: (category: MusicCategory, trackId: MusicTrackId) => void;
  onReauthorize: (category: MusicCategory, trackId: MusicTrackId) => void;
  onRelink: (category: MusicCategory, trackId: MusicTrackId) => void;
  onReorder: (category: MusicCategory, orderedIds: MusicTrackId[]) => void;
  onPlaybackModeChange: (category: MusicCategory, mode: PlaybackMode) => void;
  onPreview: (track: MusicTrackDefinition) => void;
  onStopPreview: () => void;
}) {
  const { category, title, volumeKey, enabledKey } = config;
  const tracks = library.tracks(category);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUsePicker = supportsFileSystemAccess();
  const repeatTargetId = library.playbackMode(category) === 'repeat-one'
    ? library.lastSelectedTrackId(category)
    : null;

  return (
    <fieldset className="audio-settings__channel music-card">
      <legend>{title}</legend>
      <div className="music-card__header">
        <AudioToggle
          label={title}
          checked={settings[enabledKey] as boolean}
          onChange={(checked) => onChange({ ...settings, [enabledKey]: checked })}
        />
        <div className="music-card__add-actions">
          <button
            type="button"
            className="music-card__add"
            aria-label={`添加${title}`}
            onClick={() => (canUsePicker ? onAddLinked(category) : fileInputRef.current?.click())}
          >＋</button>
          <button
            type="button"
            className="music-card__copy"
            aria-label={`复制到游戏音乐库（${title}）`}
            onClick={() => fileInputRef.current?.click()}
          >复制到游戏音乐库</button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) {
              onAddCopied(category, undefined, event.target.files);
            }
            event.target.value = '';
          }}
        />
      </div>
      <VolumeSlider
        label={`${title}音量`}
        value={settings[volumeKey] as number}
        disabled={!(settings[enabledKey] as boolean)}
        onChange={(value) => onChange({ ...settings, [volumeKey]: Number(value) / 100 })}
      />
      <MusicTrackList
        category={category}
        tracks={tracks}
        repeatTargetId={repeatTargetId}
        previewTrackId={previewTrackId}
        linkedStatus={(trackId) => library.linkedStatus(trackId)}
        onRemoveTrack={onRemoveTrack}
        onReauthorize={onReauthorize}
        onRelink={onRelink}
        onReorder={onReorder}
        onPreview={onPreview}
        onStopPreview={onStopPreview}
      />
      <PlaybackModeControl
        category={category}
        value={library.playbackMode(category)}
        onChange={(mode) => onPlaybackModeChange(category, mode)}
      />
    </fieldset>
  );
}

const SFX_GROUP_LABELS: ReadonlyArray<[GameSfxGroup, string]> = Object.freeze([
  ['draw', '摸牌音效'],
  ['discard', '弃牌音效'],
  ['meld', '鸣牌音效'],
]);

function SfxCategoryCard({
  config,
  settings,
  onChange,
  library,
  previewTrackId,
  onAddLinked,
  onAddCopied,
  onRemoveTrack,
  onReauthorize,
  onRelink,
  onReorderSfxGroup,
  onSfxPlaybackModeChange,
  onPreview,
  onStopPreview,
}: {
  config: MusicCategoryCardConfig;
  settings: AudioSettings;
  onChange: (settings: AudioSettings) => void;
  library: MusicLibraryUi;
  previewTrackId: MusicTrackId | null;
  onAddLinked: (category: MusicCategory, gameSfxGroup?: GameSfxGroup) => void;
  onAddCopied: (category: MusicCategory, gameSfxGroup: GameSfxGroup | undefined, files: FileList) => void;
  onRemoveTrack: (category: MusicCategory, trackId: MusicTrackId) => void;
  onReauthorize: (category: MusicCategory, trackId: MusicTrackId) => void;
  onRelink: (category: MusicCategory, trackId: MusicTrackId) => void;
  onReorderSfxGroup: (group: GameSfxGroup, orderedIds: MusicTrackId[]) => void;
  onSfxPlaybackModeChange: (group: GameSfxGroup, mode: PlaybackMode) => void;
  onPreview: (track: MusicTrackDefinition) => void;
  onStopPreview: () => void;
}) {
  const { title, volumeKey, enabledKey } = config;
  const canUsePicker = supportsFileSystemAccess();

  return (
    <fieldset className="audio-settings__channel music-card music-card--sfx">
      <legend>{title}</legend>
      <div className="music-card__header">
        <AudioToggle
          label={title}
          checked={settings[enabledKey] as boolean}
          onChange={(checked) => onChange({ ...settings, [enabledKey]: checked })}
        />
      </div>
      <VolumeSlider
        label={`${title}音量`}
        value={settings[volumeKey] as number}
        disabled={!(settings[enabledKey] as boolean)}
        onChange={(value) => onChange({ ...settings, [volumeKey]: Number(value) / 100 })}
      />
      <div className="music-card__sfx-groups">
        {SFX_GROUP_LABELS.map(([group, label]) => (
          <SfxGroupSection
            key={group}
            group={group}
            label={label}
            library={library}
            previewTrackId={previewTrackId}
            repeatTargetId={library.sfxPlaybackMode(group) === 'repeat-one'
              ? library.sfxLastSelectedTrackId(group)
              : null}
            playbackMode={library.sfxPlaybackMode(group)}
            canUsePicker={canUsePicker}
            onAddLinked={onAddLinked}
            onAddCopied={onAddCopied}
            onRemoveTrack={onRemoveTrack}
            onReauthorize={onReauthorize}
            onRelink={onRelink}
            onReorderSfxGroup={onReorderSfxGroup}
            onSfxPlaybackModeChange={onSfxPlaybackModeChange}
            onPreview={onPreview}
            onStopPreview={onStopPreview}
          />
        ))}
      </div>
    </fieldset>
  );
}

function SfxGroupSection({
  group,
  label,
  library,
  previewTrackId,
  repeatTargetId,
  playbackMode,
  canUsePicker,
  onAddLinked,
  onAddCopied,
  onRemoveTrack,
  onReauthorize,
  onRelink,
  onReorderSfxGroup,
  onSfxPlaybackModeChange,
  onPreview,
  onStopPreview,
}: {
  group: GameSfxGroup;
  label: string;
  library: MusicLibraryUi;
  previewTrackId: MusicTrackId | null;
  repeatTargetId: MusicTrackId | null;
  playbackMode: PlaybackMode;
  canUsePicker: boolean;
  onAddLinked: (category: MusicCategory, gameSfxGroup?: GameSfxGroup) => void;
  onAddCopied: (category: MusicCategory, gameSfxGroup: GameSfxGroup | undefined, files: FileList) => void;
  onRemoveTrack: (category: MusicCategory, trackId: MusicTrackId) => void;
  onReauthorize: (category: MusicCategory, trackId: MusicTrackId) => void;
  onRelink: (category: MusicCategory, trackId: MusicTrackId) => void;
  onReorderSfxGroup: (group: GameSfxGroup, orderedIds: MusicTrackId[]) => void;
  onSfxPlaybackModeChange: (group: GameSfxGroup, mode: PlaybackMode) => void;
  onPreview: (track: MusicTrackDefinition) => void;
  onStopPreview: () => void;
}) {
  const tracks = library.tracksBySfxGroup(group);
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="music-card__sfx-group">
      <h4 className="music-card__sfx-group-title">{label}</h4>
      <MusicTrackList
        category="effects"
        tracks={tracks}
        repeatTargetId={repeatTargetId}
        previewTrackId={previewTrackId}
        linkedStatus={library.linkedStatus}
        onRemoveTrack={onRemoveTrack}
        onReauthorize={onReauthorize}
        onRelink={onRelink}
        onReorder={(category, orderedIds) => onReorderSfxGroup(group, orderedIds)}
        onPreview={onPreview}
        onStopPreview={onStopPreview}
      />
      <div className="music-card__add-actions">
        <button
          type="button"
          className="music-card__add"
          aria-label={`添加${label}`}
          onClick={() => (canUsePicker ? onAddLinked('effects', group) : fileInputRef.current?.click())}
        >＋</button>
        <button
          type="button"
          className="music-card__copy"
          aria-label={`复制到游戏音乐库（${label}）`}
          onClick={() => fileInputRef.current?.click()}
        >复制到游戏音乐库</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) {
              onAddCopied('effects', group, event.target.files);
            }
            event.target.value = '';
          }}
        />
      </div>
      <PlaybackModeControl
        name={`music-mode-sfx-${group}`}
        value={playbackMode}
        onChange={(mode) => onSfxPlaybackModeChange(group, mode)}
      />
    </div>
  );
}

function MusicTrackList({
  category,
  tracks,
  repeatTargetId,
  previewTrackId,
  linkedStatus,
  onRemoveTrack,
  onReauthorize,
  onRelink,
  onReorder,
  onPreview,
  onStopPreview,
}: {
  category: MusicCategory;
  tracks: readonly MusicTrackDefinition[];
  repeatTargetId: MusicTrackId | null;
  previewTrackId: MusicTrackId | null;
  linkedStatus: (trackId: MusicTrackId) => LinkedTrackStatus | null;
  onRemoveTrack: (category: MusicCategory, trackId: MusicTrackId) => void;
  onReauthorize: (category: MusicCategory, trackId: MusicTrackId) => void;
  onRelink: (category: MusicCategory, trackId: MusicTrackId) => void;
  onReorder: (category: MusicCategory, orderedIds: MusicTrackId[]) => void;
  onPreview: (track: MusicTrackDefinition) => void;
  onStopPreview: () => void;
}) {
  const [draggingId, setDraggingId] = useState<MusicTrackId | null>(null);

  if (tracks.length === 0) {
    return <p className="music-track-list__empty">暂无音乐</p>;
  }

  return (
    <ul className="music-track-list">
      {tracks.map((track) => {
        const status = track.sourceType === 'linked' ? linkedStatus(track.id) : null;
        return (
          <li
            key={track.id}
            className={`music-track${draggingId === track.id ? ' music-track--dragging' : ''}${repeatTargetId === track.id ? ' music-track--repeat-one' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => {
              event.preventDefault();
              const draggedId = event.dataTransfer.getData('text/plain');
              if (!draggedId || draggedId === track.id) {
                setDraggingId(null);
                return;
              }
              const next = tracks.map((candidate) => candidate.id);
              const fromIndex = next.indexOf(draggedId);
              const toIndex = next.indexOf(track.id);
              if (fromIndex < 0 || toIndex < 0) {
                setDraggingId(null);
                return;
              }
              next.splice(fromIndex, 1);
              next.splice(toIndex, 0, draggedId);
              onReorder(category, next);
              setDraggingId(null);
            }}
          >
            {previewTrackId === track.id ? (
              <button
                type="button"
                className="music-track__preview music-track__preview--active"
                aria-label={`停止试听 ${track.name}`}
                aria-pressed
                onClick={onStopPreview}
              >■</button>
            ) : (
              <button
                type="button"
                className="music-track__preview"
                aria-label={`试听 ${track.name}`}
                aria-pressed={false}
                onClick={() => onPreview(track)}
              >▶</button>
            )}
            <span className="music-track__info">
              <span className="music-track__name" title={track.name}>{track.name}</span>
              {track.sourceType === 'linked' ? (
                status === 'needs-permission'
                  ? <button type="button" className="music-track__status-action" onClick={() => onReauthorize(category, track.id)}>重新授权</button>
                  : status === 'unavailable'
                    ? <button type="button" className="music-track__status-action" onClick={() => onRelink(category, track.id)}>重新选择</button>
                    : <small className="music-track__source">外部文件</small>
              ) : track.sourceType === 'copied'
                ? <small className="music-track__source">游戏库副本</small>
                : null}
            </span>
            <button
              type="button"
              className="music-track__drag"
              aria-label={`拖动排序 ${track.name}`}
              title="拖动排序"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', track.id);
                event.dataTransfer.effectAllowed = 'move';
                setDraggingId(track.id);
              }}
              onDragEnd={() => setDraggingId(null)}
            >≡</button>
            <button
              type="button"
              className="music-track__remove"
              aria-label={`${track.sourceType === 'builtin' ? '隐藏' : '删除'} ${track.name}`}
              title={track.sourceType === 'builtin' ? '从列表隐藏（资源保留）' : '删除'}
              onClick={() => onRemoveTrack(category, track.id)}
            >−</button>
          </li>
        );
      })}
    </ul>
  );
}

function PlaybackModeControl({
  category,
  name,
  value,
  onChange,
}: {
  category?: MusicCategory;
  name?: string;
  value: PlaybackMode;
  onChange: (mode: PlaybackMode) => void;
}) {
  return (
    <fieldset className="music-playback-mode">
      <legend>播放模式</legend>
      {(Object.keys(PLAYBACK_MODE_LABELS) as PlaybackMode[]).map((mode) => (
        <label key={mode}>
          <input
            type="radio"
            name={name ?? `music-mode-${category}`}
            value={mode}
            checked={value === mode}
            onChange={() => onChange(mode)}
          />
          <span>{PLAYBACK_MODE_LABELS[mode]}</span>
        </label>
      ))}
    </fieldset>
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

function replaceVoiceSeatAssignment(assignments: VoiceSeatAssignments, seatIndex: number, packId: string | null): VoiceSeatAssignments {
  return [
    seatIndex === 0 ? packId : assignments[0],
    seatIndex === 1 ? packId : assignments[1],
    seatIndex === 2 ? packId : assignments[2],
    seatIndex === 3 ? packId : assignments[3],
  ];
}

function MasterVolumeControl({ value, enabled, onChange }: { readonly value: number; readonly enabled: boolean; readonly onChange: (patch: Pick<AudioSettings, 'masterVolume' | 'masterEnabled'>) => void }) {
  const percent = audioVolumePercent(value);
  return <div className="audio-volume audio-volume--master"><AudioToggle label="总音量" checked={enabled} onChange={(masterEnabled) => onChange({ masterEnabled, masterVolume: value })} /><input type="range" aria-label="总音量" min="0" max="100" step="1" value={percent} onChange={(event) => onChange({ masterEnabled: enabled, masterVolume: Number(event.target.value) / 100 })} /><output>{percent}%</output></div>;
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

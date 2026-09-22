import { useEffect, useRef } from 'react';
import type { PlaybackSnapshot } from '../audio/AudioManager';
import type { AudioSettings } from '../audio/audioSettings';
import type { MusicLibraryUi } from '../audio/musicLibrary';
import type { GameSfxGroup, MusicCategory, MusicTrackDefinition, MusicTrackId, PlaybackMode } from '../audio/musicTypes';
import { AudioSettingsPanel } from './settings/AudioSettingsPanel';
import type { VoicePackSummary } from '../audio/voice/types';

interface AudioSettingsDialogProps {
  settings: AudioSettings;
  onChange: (settings: AudioSettings) => void;
  onClose: () => void;
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
  voicePlayerCount?: 2 | 3 | 4;
  onVoicePackDeleted?: (deletedPackId: string, remainingPacks: readonly VoicePackSummary[]) => void;
}

export function AudioSettingsDialog({
  settings,
  onChange,
  onClose,
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
  voicePlayerCount = 4,
  onVoicePackDeleted,
}: AudioSettingsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLInputElement>('[aria-label="总音量"]')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="result-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="result-dialog audio-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-settings-dialog-title"
      >
        <header className="result-header">
          <div>
            <h2 id="audio-settings-dialog-title">音频设置</h2>
            <p>修改即时生效，并自动保存在本机。</p>
          </div>
        </header>
        <div className="audio-settings-dialog__body">
          <AudioSettingsPanel
            settings={settings}
            onChange={onChange}
            library={library}
            playback={playback}
            previewTrackId={previewTrackId}
            notice={notice}
            onAddLinked={onAddLinked}
            onAddCopied={onAddCopied}
            onRemoveTrack={onRemoveTrack}
            onReauthorize={onReauthorize}
            onRelink={onRelink}
            onReorder={onReorder}
            onReorderSfxGroup={onReorderSfxGroup}
            onSfxPlaybackModeChange={onSfxPlaybackModeChange}
            onPlaybackModeChange={onPlaybackModeChange}
            onPreview={onPreview}
            onStopPreview={onStopPreview}
            onTogglePlayback={onTogglePlayback}
            onSeekPlayback={onSeekPlayback}
            onPreviousTrack={onPreviousTrack}
            onNextTrack={onNextTrack}
            onManageVoicePack={onManageVoicePack}
            onCreateVoicePack={onCreateVoicePack}
            voicePlayerCount={voicePlayerCount}
            onVoicePackDeleted={onVoicePackDeleted}
          />
        </div>
        <footer className="result-actions">
          <button type="button" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import type { AudioSettings } from '../audio/audioSettings';
import { AudioSettingsPanel } from './settings/AudioSettingsPanel';

interface AudioSettingsDialogProps {
  settings: AudioSettings;
  onChange: (settings: AudioSettings) => void;
  onClose: () => void;
}

export function AudioSettingsDialog({ settings, onChange, onClose }: AudioSettingsDialogProps) {
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
          <AudioSettingsPanel settings={settings} onChange={onChange} />
        </div>
        <footer className="result-actions">
          <button type="button" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import type { PlayerProfile } from '../profile/playerProfile';
import { PlayerProfileSettings } from './settings/PlayerProfileSettings';

interface PlayerProfileDialogProps {
  profile: PlayerProfile;
  onChange: (profile: PlayerProfile) => void;
  onClose: () => void;
}

export function PlayerProfileDialog({ profile, onChange, onClose }: PlayerProfileDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLInputElement>('[aria-label="玩家昵称"]')?.focus();

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
        className="result-dialog player-profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-dialog-title"
      >
        <header className="result-header">
          <div>
            <h2 id="player-profile-dialog-title">玩家设置</h2>
            <p>修改会立即保存，并同步到本地麻将界面。</p>
          </div>
        </header>
        <div className="player-profile-dialog__body">
          <PlayerProfileSettings profile={profile} onChange={onChange} />
        </div>
        <footer className="result-actions">
          <button type="button" onClick={onClose}>完成</button>
        </footer>
      </section>
    </div>
  );
}

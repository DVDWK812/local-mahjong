import type { SavedMatch } from '../game/persistence/storageTypes';
import { Dialog, DIALOG_INTERACTION_POLICIES } from './Dialog';

interface ContinueMatchDialogProps {
  save: SavedMatch | null;
  error?: string | null;
  onContinue: () => void;
  onDiscard: () => void;
}

export function ContinueMatchDialog({ save, error, onContinue, onDiscard }: ContinueMatchDialogProps) {
  if (!save && !error) return null;
  return (
    <Dialog policy={DIALOG_INTERACTION_POLICIES.continueMatch} labelledBy="continue-match-title" describedBy="continue-match-description" testId="continue-match-dialog">
        <div className="result-header">
          <div>
            <h2 id="continue-match-title">继续对局</h2>
            <p id="continue-match-description">{error ?? `最近保存：${save?.savedAt}`}</p>
          </div>
        </div>
        <div className="call-actions">
          {save ? <button type="button" onClick={onContinue} data-dialog-initial-focus="true">继续比赛</button> : null}
          <button type="button" onClick={onDiscard} data-dialog-initial-focus={save ? undefined : 'true'}>放弃存档</button>
        </div>
    </Dialog>
  );
}

import type { SavedMatch } from '../game/persistence/storageTypes';

interface ContinueMatchDialogProps {
  save: SavedMatch | null;
  error?: string | null;
  onContinue: () => void;
  onDiscard: () => void;
}

export function ContinueMatchDialog({ save, error, onContinue, onDiscard }: ContinueMatchDialogProps) {
  if (!save && !error) return null;
  return (
    <div className="result-backdrop" role="presentation">
      <section className="result-dialog" role="dialog" aria-modal="true">
        <div className="result-header">
          <div>
            <h2>继续对局</h2>
            <p>{error ?? `最近保存：${save?.savedAt}`}</p>
          </div>
        </div>
        <div className="call-actions">
          {save ? <button type="button" onClick={onContinue}>继续比赛</button> : null}
          <button type="button" onClick={onDiscard}>放弃存档</button>
        </div>
      </section>
    </div>
  );
}

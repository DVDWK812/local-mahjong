import { Dialog, DIALOG_INTERACTION_POLICIES } from './Dialog';

interface ExitGameDialogProps {
  matchEnded: boolean;
  saving?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRetry?: () => void;
  onExitWithoutSaving?: () => void;
}

export function ExitGameDialog({
  matchEnded,
  saving = false,
  error = null,
  onCancel,
  onConfirm,
  onRetry,
  onExitWithoutSaving,
}: ExitGameDialogProps) {
  const dismissible = !matchEnded && !saving;
  const policy = dismissible
    ? DIALOG_INTERACTION_POLICIES.exitGame
    : DIALOG_INTERACTION_POLICIES.matchResult;
  return (
    <Dialog
      policy={policy}
      onDismiss={dismissible ? onCancel : undefined}
      labelledBy="exit-game-title"
      describedBy="exit-game-description"
      testId="exit-game-dialog"
    >
        <div className="result-header">
          <div>
            <h2 id="exit-game-title">退出当前对局？</h2>
            <p id="exit-game-description">{matchEnded ? '当前比赛已经结束，可以返回主菜单。' : '返回菜单将结束当前显示的对局。已保存的对局可稍后继续。'}</p>
            {error ? <p className="save-status save-status--error">{error}</p> : null}
          </div>
        </div>
        <div className="call-actions">
          {error ? (
            <>
              <button type="button" onClick={onRetry ?? onConfirm} disabled={saving}>重试保存</button>
              <button type="button" onClick={onExitWithoutSaving} disabled={saving}>不保存并退出</button>
              {!matchEnded ? <button type="button" onClick={onCancel} disabled={saving} data-dialog-initial-focus="true">继续游戏</button> : null}
            </>
          ) : (
            <>
              {!matchEnded ? <button type="button" onClick={onCancel} disabled={saving} data-dialog-initial-focus="true">继续游戏</button> : null}
              <button type="button" onClick={onConfirm} disabled={saving} data-dialog-initial-focus={matchEnded ? 'true' : undefined}>{saving ? '保存中' : '确认退出'}</button>
            </>
          )}
        </div>
    </Dialog>
  );
}

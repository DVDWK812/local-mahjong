interface ExitGameDialogProps {
  matchEnded: boolean;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ExitGameDialog({ matchEnded, saving = false, onCancel, onConfirm }: ExitGameDialogProps) {
  return (
    <div className="result-backdrop" role="presentation">
      <section className="result-dialog" role="dialog" aria-modal="true" aria-label="退出当前对局？">
        <div className="result-header">
          <div>
            <h2>退出当前对局？</h2>
            <p>{matchEnded ? '当前比赛已经结束，可以返回主菜单。' : '返回菜单将结束当前显示的对局。已保存的对局可稍后继续。'}</p>
          </div>
        </div>
        <div className="call-actions">
          {!matchEnded ? <button type="button" onClick={onCancel} disabled={saving}>继续游戏</button> : null}
          <button type="button" onClick={onConfirm} disabled={saving}>{saving ? '保存中' : '确认退出'}</button>
        </div>
      </section>
    </div>
  );
}

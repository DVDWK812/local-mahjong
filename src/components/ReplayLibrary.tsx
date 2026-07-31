import type { ReplayMetadata } from '../game/persistence/storageTypes';

interface ReplayLibraryProps {
  replays: ReplayMetadata[];
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onStartLocalMatch: () => void;
}

const MATCH_TYPE_LABELS: Record<ReplayMetadata['matchType'], string> = {
  'four-east': '四人东',
  'four-south': '四人南',
  single: '单场',
};

export function ReplayLibrary({
  replays,
  onOpen,
  onRename,
  onDelete,
  onExport,
  onStartLocalMatch,
}: ReplayLibraryProps) {
  return (
    <section className="replay-library">
      <h2>牌谱列表</h2>
      {replays.length === 0 ? (
        <div className="replay-empty">
          <strong>还没有保存的牌谱</strong>
          <p>完成一场本地对局，或中途退出时选择保存，牌谱会出现在这里。</p>
          <button type="button" onClick={onStartLocalMatch}>开始本地对局</button>
        </div>
      ) : null}
      {replays.map((replay) => {
        const corrupted = replay.status === 'corrupted';
        return (
          <article key={replay.id} className={`replay-card${corrupted ? ' replay-card--error' : ''}`}>
            <div className="replay-card__header">
              <div>
                <h3>{replay.title}</h3>
                <p>{formatSavedAt(replay.updatedAt)}</p>
              </div>
              <span>{corrupted ? '错误' : replay.status === 'completed' ? '完成' : '未完成'}</span>
            </div>
            {corrupted ? (
              <p className="save-status save-status--error">此记录已损坏：{replay.error ?? '无法解析'}</p>
            ) : (
              <dl className="replay-card__metadata">
                <div><dt>模式</dt><dd>{MATCH_TYPE_LABELS[replay.matchType]}</dd></div>
                <div><dt>玩家</dt><dd>{replay.playerNames.join(' / ')}</dd></div>
                <div><dt>分数</dt><dd>{replay.scores.join(' / ')}</dd></div>
                <div><dt>总局数</dt><dd>{replay.roundCount}</dd></div>
                <div><dt>来源</dt><dd>本地对局</dd></div>
              </dl>
            )}
            <div className="call-actions">
              <button type="button" onClick={() => onOpen(replay.id)} disabled={corrupted}>打开</button>
              <button type="button" onClick={() => onRename(replay.id)} disabled={corrupted}>重命名</button>
              <button type="button" onClick={() => onDelete(replay.id)}>删除</button>
              <button type="button" onClick={() => onExport(replay.id)} disabled={corrupted}>导出JSON</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function formatSavedAt(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? `保存于 ${date.toLocaleString('zh-CN', { hour12: false })}`
    : '保存时间未知';
}

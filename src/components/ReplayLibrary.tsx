import type { ReplayMetadata } from '../game/persistence/storageTypes';

interface ReplayLibraryProps {
  replays: ReplayMetadata[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ReplayLibrary({ replays, onOpen, onDelete }: ReplayLibraryProps) {
  return (
    <section className="replay-library">
      <h3>牌谱列表</h3>
      {replays.length === 0 ? <p>暂无牌谱。</p> : null}
      {replays.map((replay) => (
        <div key={replay.matchId} className="score-history-row">
          <span>{replay.createdAt} · {replay.playerNames.join(' / ')}</span>
          <div className="call-actions">
            <button type="button" onClick={() => onOpen(replay.matchId)}>回放</button>
            <button type="button" onClick={() => onDelete(replay.matchId)}>删除</button>
          </div>
        </div>
      ))}
    </section>
  );
}

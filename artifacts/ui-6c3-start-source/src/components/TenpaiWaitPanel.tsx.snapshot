import type { TenpaiDisplay } from '../game/tenpaiDisplay';
import { Tile } from './Tile';

interface TenpaiWaitPanelProps {
  display: TenpaiDisplay | null;
}

export function TenpaiWaitPanel({ display }: TenpaiWaitPanelProps) {
  if (!display) return null;
  return (
    <section className="tenpai-wait-panel" aria-label="听牌与剩余量">
      <div className="tenpai-wait-header">
        <strong>{display.previewDiscardLabel ? `打出${display.previewDiscardLabel}后听牌` : '听牌'}</strong>
        <span className="tenpai-wait-total">总有效枚数 {display.totalRemaining}</span>
        {display.currentFuritenLabel ? <span className="tenpai-furiten-badge">{display.currentFuritenLabel}</span> : null}
      </div>
      <div className="tenpai-wait-list">
        {display.waits.map((wait) => (
          <div key={wait.id} className={`tenpai-wait-item ${wait.remaining === 0 ? 'tenpai-wait-item--empty' : ''}`}>
            <Tile id={wait.id} compact interactive={false} />
            <span className="tenpai-wait-count">×{wait.remaining}</span>
            {wait.status !== 'winnable' ? (
              <span className={`tenpai-wait-status tenpai-wait-status--${wait.status}`}>
                {wait.status === 'no-yaku'
                  ? '无役'
                  : wait.status === 'insufficient-han'
                    ? '番数不足'
                    : wait.status === 'permanent-furiten'
                      ? '永久振听'
                      : '振听'}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

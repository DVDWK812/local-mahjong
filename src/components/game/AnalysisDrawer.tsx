import { useEffect } from 'react';
import type { GameState } from '../../game/types';
import { AnalysisPanel } from '../AnalysisPanel';
import { TileCounter } from '../TileCounter';

interface AnalysisDrawerProps {
  open: boolean;
  gameState: GameState;
  onClose: () => void;
}

export function AnalysisDrawer({ open, gameState, onClose }: AnalysisDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <aside className={`analysis-drawer ${open ? 'analysis-drawer--open' : ''}`} aria-label="牌局分析抽屉" aria-hidden={!open}>
      <div className="analysis-drawer-header">
        <strong>牌局分析</strong>
        <button type="button" aria-label="关闭牌局分析" onClick={onClose}>关闭</button>
      </div>
      <div className="analysis-drawer-body">
        <AnalysisPanel gameState={gameState} />
        <TileCounter gameState={gameState} />
      </div>
    </aside>
  );
}

import type { MatchState } from '../../game/match/types';
import type { GameState, Wind } from '../../game/types';

interface GameTopBarProps {
  gameState: GameState;
  matchState?: MatchState;
  analysisOpen: boolean;
  onOpenRulesGuide: () => void;
  onOpenAudioSettings: () => void;
  onToggleAnalysis: () => void;
  onReturnMenu: () => void;
  modeLabel?: string;
  phaseLabelOverride?: string;
  currentPlayerDisplayName?: string;
}

const phaseLabels: Record<GameState['phase'], string> = {
  draw: '摸牌',
  discard: '打牌',
  'ron-window': '荣和确认',
  'call-window': '鸣牌窗口',
  'kakan-declaration': '加杠宣告',
  'chankan-window': '抢杠窗口',
  'rinshan-draw': '岭上摸牌',
  'round-ended': '本局结束',
  'exhaustive-draw': '流局',
};

const windNames: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

export function GameTopBar({ gameState, analysisOpen, onOpenRulesGuide, onOpenAudioSettings, onToggleAnalysis, onReturnMenu, modeLabel, phaseLabelOverride, currentPlayerDisplayName }: GameTopBarProps) {
  const current = gameState.players[gameState.currentPlayer];

  return (
    <header className="game-top-bar" aria-label="对局状态栏">
      <div className="game-top-bar-section game-top-bar-section--turn">
        <span>{modeLabel ? `模式：${modeLabel}　` : ''}轮到：{windNames[current.seatWind]}家 {currentPlayerDisplayName ?? current.name}</span>
        <span>{phaseLabelOverride ?? phaseLabels[gameState.phase]}</span>
      </div>
      <div className="game-top-bar-actions">
        <button type="button" className="game-top-bar-music" aria-label="音乐设置" title="音乐设置" onClick={onOpenAudioSettings}>♪</button>
        <button type="button" onClick={onOpenRulesGuide}>规则说明</button>
        <button type="button" aria-pressed={analysisOpen} onClick={onToggleAnalysis}>牌局分析</button>
        <button type="button" onClick={onReturnMenu}>返回菜单</button>
      </div>
    </header>
  );
}

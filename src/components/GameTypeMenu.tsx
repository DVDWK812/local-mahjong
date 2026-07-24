import { BackButton } from './BackButton';

interface GameTypeMenuProps {
  onBack: () => void;
  onEast: () => void;
  onSouth: () => void;
}

export function GameTypeMenu({ onBack, onEast, onSouth }: GameTypeMenuProps) {
  return (
    <main className="menu-page">
      <section className="menu-panel">
        <BackButton onClick={onBack} />
        <p className="menu-path">本地模式 ＞ 立直麻将 ＞ 四人间</p>
        <h1>选择比赛长度</h1>
        <div className="menu-actions">
          <button type="button" onClick={onEast}>四人东</button>
          <button type="button" onClick={onSouth}>四人南</button>
        </div>
      </section>
    </main>
  );
}

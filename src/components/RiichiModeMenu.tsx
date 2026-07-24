import { BackButton } from './BackButton';

interface RiichiModeMenuProps {
  notice?: string | null;
  onBack: () => void;
  onFourPlayer: () => void;
  onThreePlayer: () => void;
}

export function RiichiModeMenu({ notice, onBack, onFourPlayer, onThreePlayer }: RiichiModeMenuProps) {
  return (
    <main className="menu-page">
      <section className="menu-panel">
        <BackButton onClick={onBack} />
        <p className="menu-path">本地模式 ＞ 立直麻将</p>
        <h1>选择人数</h1>
        {notice ? <p className="menu-notice">{notice}</p> : null}
        <div className="menu-actions">
          <button type="button" onClick={onFourPlayer}>四人间</button>
          <button type="button" onClick={onThreePlayer}>三人间 <span>敬请期待</span></button>
        </div>
      </section>
    </main>
  );
}

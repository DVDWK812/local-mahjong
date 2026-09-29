import { BackButton } from './BackButton';

interface LocalModeMenuProps {
  notice?: string | null;
  onBack: () => void;
  onRiichi: () => void;
  onXuezhan?: () => void;
  onComingSoon: (label: string) => void;
}

export function LocalModeMenu({ notice, onBack, onRiichi, onXuezhan, onComingSoon }: LocalModeMenuProps) {
  return (
    <main className="menu-page">
      <section className="menu-panel">
        <BackButton onClick={onBack} />
        <p className="menu-path">本地模式</p>
        <h1>选择玩法</h1>
        {notice ? <p className="menu-notice">{notice}</p> : null}
        <div className="menu-actions">
          <button type="button" onClick={() => onComingSoon('剧情模式')}>剧情模式 <span>敬请期待</span></button>
          <button type="button" onClick={onRiichi}>立直麻将</button>
          <button type="button" onClick={onXuezhan}>血战到底</button>
          <button type="button" onClick={() => onComingSoon('国标麻将')}>国标麻将 <span>敬请期待</span></button>
        </div>
      </section>
    </main>
  );
}

import { BackButton } from './BackButton';

interface RiichiModeMenuProps {
  notice?: string | null;
  onBack: () => void;
  onFourPlayer: () => void;
  onThreePlayer: () => void;
  on17Steps?: () => void;
  onWashizu?: () => void;
  onSuperpower?: () => void;
  onRulesGuide?: () => void;
}

export function RiichiModeMenu({ notice, onBack, onFourPlayer, onThreePlayer, on17Steps, onWashizu, onSuperpower, onRulesGuide }: RiichiModeMenuProps) {
  return (
    <main className="menu-page">
      <section className="menu-panel" aria-label="选择人数">
        <BackButton onClick={onBack} />
        <p className="menu-path">本地模式 ： 立直麻将</p>
        <button type="button" onClick={onRulesGuide ?? (() => undefined)}>规则说明</button>
        <h1>经典模式</h1>
        {notice ? <p className="menu-notice">{notice}</p> : null}
        <div className="menu-actions">
          <button type="button" onClick={onFourPlayer}>四人间</button>
          <button type="button" onClick={onThreePlayer}>三人间<span>敬请期待</span></button>
          <h1>娱乐模式</h1>
          <button type="button" onClick={on17Steps ?? (() => undefined)}>17步麻将</button>
          <button type="button" onClick={onWashizu ?? (() => undefined)}>鹫巢麻将</button>
          <button type="button" onClick={onSuperpower ?? (() => undefined)}>超能力麻将</button>
          
          
        </div>
      </section>
    </main>
  );
}

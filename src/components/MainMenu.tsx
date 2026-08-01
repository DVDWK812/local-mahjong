interface MainMenuProps {
  hasSave: boolean;
  notice?: string | null;
  onContinue: () => void;
  onLocalMode: () => void;
  onOnlineMode: () => void;
  onReplayStudy: () => void;
  testModeEnabled?: boolean;
  onTestMode?: () => void;
}

export function MainMenu({ hasSave, notice, onContinue, onLocalMode, onOnlineMode, onReplayStudy, testModeEnabled = false, onTestMode = () => undefined }: MainMenuProps) {
  return (
    <main className="menu-page">
      <section className="menu-panel">
        <p className="menu-path">主菜单</p>
        <h1>麻将训练器</h1>
        {notice ? <p className="menu-notice">{notice}</p> : null}
        <div className="menu-actions">
          {hasSave ? <button type="button" onClick={onContinue}>继续对局</button> : null}
          <button type="button" onClick={onLocalMode}>本地模式</button>
          <button type="button" onClick={onOnlineMode}>联机模式 <span>敬请期待</span></button>
          <button type="button" onClick={onReplayStudy}>牌谱研习</button>
          {testModeEnabled ? <button type="button" className="test-mode-entry" onClick={onTestMode}>测试模式 <span>开发者</span></button> : null}
        </div>
      </section>
    </main>
  );
}

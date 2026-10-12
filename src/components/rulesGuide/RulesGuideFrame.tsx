import './rulesGuideFrame.css';
import { useEffect, useRef, type ReactNode } from 'react';

/** Shared reading chrome for the existing rules pages; content remains mode-owned. */
export function RulesGuideFrame({ title, onBack, embedded = false, tabs, active, onTab, children, search }: {
  title: string; onBack: () => void; embedded?: boolean; tabs: Record<string, string>; active: string;
  onTab: (id: string) => void; children: ReactNode; search?: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null), back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    back.current?.focus();
    return () => previous?.focus();
  }, []);
  return <main className={embedded ? 'rules-guide rules-guide--overlay' : 'rules-guide'} onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); onBack(); }
    if (e.key === 'Tab' && embedded) {
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex="0"]') ?? [])];
      const first = items[0], last = items[items.length-1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <section ref={panel} className="rules-guide-panel" aria-label={title}>
      <header className="rules-guide-header">
        <button ref={back} type="button" onClick={onBack}>返回</button><h1>{title}</h1>
        <nav className="rules-tabs" aria-label="规则说明选项卡">{Object.entries(tabs).map(([id, label]) =>
          <button key={id} type="button" aria-pressed={active === id} onClick={() => onTab(id)}>{label}</button>)}</nav>
        {search}
      </header>
      <div className="rules-guide-content">{children}</div>
    </section>
  </main>;
}

export function RulesGuideSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="rules-guide-search">搜索规则<input type="search" aria-label="搜索规则" placeholder="名称、条件或常见问题" value={value} onChange={e => onChange(e.target.value)} /></label>;
}

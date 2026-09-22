import { BackButton } from './BackButton';

export type RiichiVariant = '17-steps' | 'washizu' | 'superpower';

interface RiichiVariantPlaceholderProps {
  variant: RiichiVariant;
  onBack: () => void;
}

const VARIANT_CONTENT: Record<RiichiVariant, { title: string; description: string }> = {
  '17-steps': {
    title: '17步麻将',
    description: '17步麻将模式窗口已建立，具体规则与对局流程将在后续实现。',
  },
  washizu: {
    title: '鹫巢麻将',
    description: '鹫巢麻将模式窗口已建立，具体规则与对局流程将在后续实现。',
  },
  superpower: {
    title: '超能力麻将',
    description: '超能力麻将模式窗口已建立，具体规则与对局流程将在后续实现。',
  },
};

export function RiichiVariantPlaceholder({ variant, onBack }: RiichiVariantPlaceholderProps) {
  const content = VARIANT_CONTENT[variant];

  return (
    <main className="menu-page">
      <section className="menu-panel" aria-label={`${content.title}模式窗口`}>
        <BackButton onClick={onBack} />
        <p className="menu-path">本地模式 ＞ 立直麻将 ＞ {content.title}</p>
        <h1>{content.title}</h1>
        <p className="mode-placeholder-copy">{content.description}</p>
        <div className="mode-placeholder-panel" aria-label="模式开发占位区域">
          <span>模式开发中</span>
        </div>
      </section>
    </main>
  );
}

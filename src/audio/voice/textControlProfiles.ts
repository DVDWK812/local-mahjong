export interface TextControl { readonly label: string; readonly token: string; }
export interface TextControlGroup { readonly label: string; readonly controls: readonly TextControl[]; }
export interface TextControlProfile { readonly kind: 'fish-s2' | 'fish-s1' | 'minimax-2.8' | 'none'; readonly help: string; readonly groups: readonly TextControlGroup[]; }

const fishS2: TextControlProfile = {
  kind: 'fish-s2',
  help: 'Fish S2 系列支持方括号自然语言控制。以下是常用示例，不是完整固定词表。',
  groups: [
    { label: '情绪', controls: examples([['生气', '[angry]'], ['难过', '[sad]'], ['尴尬', '[embarrassed]'], ['兴奋', '[excited]']]) },
    { label: '说话方式', controls: examples([['低声', '[whispering]'], ['轻声', '[soft]'], ['气声', '[breathy]'], ['强调', '[emphasis]']]) },
    { label: '声音效果', controls: examples([['笑声', '[laughing]'], ['轻笑', '[chuckling]'], ['呻吟', '[moaning]'], ['清嗓', '[clear throat]'], ['啜泣', '[sobbing]'], ['大哭', '[crying loudly]'], ['叹气', '[sighing]'], ['喘气', '[panting]'], ['低吟', '[groaning]'], ['人群笑声', '[crowd laughing]'], ['背景笑声', '[background laughter]'], ['观众笑声', '[audience laughing]']]) },
    { label: '停顿', controls: examples([['短暂停顿', '[pause]'], ['长停顿', '[long pause]']]) },
  ],
};

const minimax: TextControlProfile = {
  kind: 'minimax-2.8',
  help: '仅 MiniMax Speech 2.8 HD / Turbo。停顿格式为 <#x#>，x 为 0.01–99.99 秒，最多两位小数。',
  groups: [
    { label: '停顿', controls: examples([['0.5 秒', '<#0.5#>'], ['1 秒', '<#1#>'], ['1.5 秒', '<#1.5#>'], ['2 秒', '<#2#>']]) },
    { label: '语气词', controls: ['(laughs)', '(chuckle)', '(coughs)', '(clear-throat)', '(groans)', '(breath)', '(pant)', '(inhale)', '(exhale)', '(gasps)', '(sniffs)', '(sighs)', '(snorts)', '(burps)', '(lip-smacking)', '(humming)', '(hissing)', '(emm)', '(sneezes)'].map((token) => ({ label: token, token })) },
  ],
};

const fishS1: TextControlProfile = { kind: 'fish-s1', help: 'Fish S1 使用固定圆括号标签；当前没有可靠的完整标签目录，因此不提供可能错误的快捷标签。', groups: [] };
const none: TextControlProfile = { kind: 'none', help: '当前模型没有已知的文本控制标签。', groups: [] };

export function textControlProfileForModel(modelId: string): TextControlProfile {
  const normalized = modelId.trim().toLowerCase();
  if (/^minimax-2\.8-(hd|turbo)$/.test(normalized)) return minimax;
  if (normalized === 'fishaudio-s1') return fishS1;
  if (/^fishaudio-s2(?:\.1)?(?:pro)?(?:-|$)/.test(normalized) || normalized.startsWith('fishaudio-s21')) return fishS2;
  return none;
}

function examples(values: readonly (readonly [string, string])[]): TextControl[] { return values.map(([label, token]) => ({ label, token })); }

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const tokens = readFileSync(resolve(root, 'src/styles/tokens.css'), 'utf8');
const styles = readFileSync(resolve(root, 'src/styles.css'), 'utf8');
const main = readFileSync(resolve(root, 'src/main.tsx'), 'utf8');

describe('UI Design Tokens', () => {
  it('从单一全局入口加载关键语义 Token', () => {
    expect(main).toContain("import './styles/tokens.css'");
    for (const token of ['--motion-fast', '--z-table', '--z-modal', '--space-1', '--radius-sm', '--shadow-tile', '--tile-select-offset']) {
      expect(tokens).toContain(`${token}:`);
      expect(styles).not.toContain(`${token}:`);
    }
  });

  it('Token 名称在来源文件中保持唯一', () => {
    const names = [...tokens.matchAll(/--[a-z0-9-]+(?=\s*:)/g)].map(([name]) => name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('麻将牌、操作层和层级使用语义 Token', () => {
    for (const usage of [
      'transition: opacity var(--motion-fast)',
      'transform: translateY(var(--tile-select-offset))',
      'box-shadow: var(--shadow-tile)',
      'z-index: var(--z-river)',
      'z-index: var(--z-hand)',
      'z-index: var(--z-action)',
      'z-index: var(--z-modal)',
    ]) {
      expect(styles).toContain(usage);
    }
  });
});

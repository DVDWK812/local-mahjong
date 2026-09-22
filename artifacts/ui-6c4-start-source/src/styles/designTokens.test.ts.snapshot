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
    for (const token of ['--motion-fast', '--z-table', '--z-modal', '--space-1', '--radius-sm', '--shadow-tile', '--tile-select-offset', '--mahjong-table-perspective', '--mahjong-table-edge-depth', '--mahjong-tile-depth', '--mahjong-tile-local-depth', '--mahjong-tile-river-depth', '--mahjong-tile-meld-depth', '--mahjong-tile-opponent-depth', '--mahjong-tile-wall-depth', '--mahjong-tile-side', '--mahjong-tile-bottom', '--mahjong-tile-edge-highlight']) {
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
      'perspective(var(--mahjong-table-perspective))',
      'bottom: calc(-1 * var(--tile-depth))',
      '--tile-depth: var(--mahjong-tile-local-depth)',
      '--tile-depth: var(--mahjong-tile-river-depth)',
      '--tile-depth: var(--mahjong-tile-meld-depth)',
      '--tile-depth: var(--mahjong-tile-opponent-depth)',
      '--tile-depth: var(--mahjong-tile-wall-depth)',
    ]) {
      expect(styles).toContain(usage);
    }
  });
});

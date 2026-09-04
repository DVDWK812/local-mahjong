import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppearanceLibraryGrid } from './AppearanceImageLibrary';

describe('shared appearance library grid', () => {
  it('shows inherit as a distinct virtual selection without selecting or deleting the default', () => {
    const html = renderToStaticMarkup(<AppearanceLibraryGrid label="牌背" aspectRatio={1.08 / 1.46}
      defaultRef={{ kind: 'builtin', id: 'default' }} defaultPreview={<span>默认牌背</span>}
      selected={null} onInherit={() => undefined} onSelect={() => undefined} onDelete={() => undefined} entries={[]} />);
    expect(html).toMatch(/牌背跟随全局" aria-pressed="true"/);
    expect(html).toMatch(/选择牌背：默认" aria-pressed="false"/);
    expect(html).not.toContain('appearance-library-delete');
  });
  it('renders the selectable default first without a delete button, then selected custom cards', () => {
    const html = renderToStaticMarkup(<AppearanceLibraryGrid label="头像" aspectRatio={3 / 4}
      defaultRef={{ kind: 'builtin', id: 'avatar-01' }} defaultPreview={<span>默认头像</span>}
      selected={{ kind: 'local', assetId: 'saved-a' }} onSelect={() => undefined} onDelete={() => undefined}
      entries={[{ kind: 'avatar', assetId: 'saved-a', width: 512, height: 683, mimeType: 'image/png', createdAt: 1 }]} />);
    expect(html.indexOf('data-library-default')).toBeLessThan(html.indexOf('data-library-asset-id'));
    expect(html).toContain('aria-label="选择头像：默认"');
    expect(html).toMatch(/选择头像：自定义 1" aria-pressed="true"/);
    expect(html.match(/aria-label="删除头像/g)).toHaveLength(1);
    expect(html).not.toContain('删除头像：默认');
    expect(html).toContain('--library-aspect:0.75');
  });
});

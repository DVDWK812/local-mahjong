import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SaveStatusIndicator } from './SaveStatusIndicator';

describe('SaveStatusIndicator', () => {
  it('renders saving, saved, and error states', () => {
    expect(renderToStaticMarkup(<SaveStatusIndicator status="saving" />)).toContain('正在保存');
    expect(renderToStaticMarkup(<SaveStatusIndicator status="saved" savedAt="now" />)).toContain('已保存');
    expect(renderToStaticMarkup(<SaveStatusIndicator status="error" error="quota" />)).toContain('quota');
  });
});

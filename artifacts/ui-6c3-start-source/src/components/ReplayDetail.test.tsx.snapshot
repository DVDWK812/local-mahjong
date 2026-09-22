import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sampleReplayRecord } from '../game/persistence/saveTestUtils';
import { ReplayDetail } from './ReplayDetail';

describe('ReplayDetail', () => {
  it('直接渲染全屏播放器且不重复详情元数据', () => {
    const html = renderToStaticMarkup(<ReplayDetail replay={sampleReplayRecord({ title: '测试牌谱' })} />);
    expect(html).toContain('data-testid="replay-screen"');
    expect(html).toContain('牌谱逐步回放');
    expect(html).toContain('本局开始');
    expect(html).toContain('全牌公开');
    expect(html).toContain('东1局');
    expect(html).not.toContain('测试牌谱');
    expect(html).not.toContain('<dt>模式</dt>');
    expect(html).not.toContain('选择局数、步骤和观看视角');
  });
});

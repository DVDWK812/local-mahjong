import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SeventeenStepsMatchSettings } from './SeventeenStepsMatchSettings';
import { DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG } from '../game/seventeenSteps';

describe('17步麻将专用比赛设置', () => {
  it('只显示一个AI，并将比赛场数表达为来回与总局数', () => {
    const html = renderToStaticMarkup(
      <SeventeenStepsMatchSettings
        config={DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG}
        onBack={() => undefined}
        onConfigChange={() => undefined}
        onStart={() => undefined}
      />,
    );
    expect(html).toContain('AI 对手');
    expect(html).not.toContain('AI 玩家2');
    expect(html).not.toContain('目标点数');
    expect(html).not.toContain('返还点');
    expect(html).toContain('1场（2局）');
    expect(html).toContain('宝牌计入番缚判定');
    expect(html).not.toContain('显示听牌与剩余量');
    expect(html).not.toContain('宝牌计入满贯判定');
    expect(html).toContain('击飞结束');
    expect(html).not.toContain('九种九牌');
    expect(html).not.toContain('一发');
  });
});

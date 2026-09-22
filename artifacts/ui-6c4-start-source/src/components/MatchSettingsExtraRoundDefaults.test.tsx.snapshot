import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getRulePreset } from '../game/match/matchRules';
import { MatchSettings, normalizeMatchSettingsConfig } from './MatchSettings';

describe('比赛设置延长场风默认值', () => {
  it('四人东默认最大延长场风为南，返还点为25000', () => {
    const config = getRulePreset('east-round');
    expect(config.match.maxExtraRoundWind).toBe('south');
    expect(config.match.returnPoints).toBe(25000);
  });

  it('四人南默认最大延长场风为西，返还点为25000，界面不显示南选项', () => {
    const config = getRulePreset('south-round');
    const html = renderToStaticMarkup(<MatchSettings config={config} onConfigChange={() => undefined} />);
    expect(config.match.maxExtraRoundWind).toBe('west');
    expect(config.match.returnPoints).toBe(25000);
    expect(html).not.toContain('value="south"');
  });

  it('四人南旧配置中的南风延长会自动迁移为西', () => {
    const config = getRulePreset('south-round');
    const normalized = normalizeMatchSettingsConfig({
      ...config,
      match: { ...config.match, maxExtraRoundWind: 'south' },
    });
    expect(normalized.match.maxExtraRoundWind).toBe('west');
  });
});

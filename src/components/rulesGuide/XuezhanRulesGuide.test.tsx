import { renderToStaticMarkup as render } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { XuezhanRulesGuide } from './XuezhanRulesGuide';
import { XuezhanSettings } from '../XuezhanSettings';
import { GameTopBarView } from '../game/GameTopBar';
import { createConfig, presetRules } from '../../game/xuezhan/config';
import { LocalModeMenu } from '../LocalModeMenu';
const noop=()=>{};
afterEach(()=>vi.unstubAllGlobals());
describe('血战规则入口与设置能力',()=>{
  it('赛前与局内使用同一番型正文，读取各自配置',()=>{
    const rules=presetRules();rules.patterns.pure.fan=3;rules.patterns.middle.enabled=true;
    const config=createConfig(rules);
    const draft=render(<XuezhanRulesGuide config={config} context="draft" initialTab="patterns" onBack={noop}/>);
    const match=render(<XuezhanRulesGuide config={config} context="match" initialTab="patterns" onBack={noop}/>);
    for(const html of [draft,match]) { expect(html.match(/data-pattern=/g)).toHaveLength(16);expect(html).toContain('清一色 · 3番');expect(html).toContain('搜索规则');expect(html).toContain('rules-tabs'); }
    expect(draft).toContain('当前草稿');expect(match).toContain('本场规则快照');
  });
  it('普通设置只保留学习和配置；高级默认折叠且旧草稿可读',()=>{
    const rules=presetRules();rules.base=7;
    vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(createConfig(rules))});
    const html=render(<XuezhanSettings onBack={noop} onStart={noop}/>);
    expect(html).toContain('比赛规则');expect(html).toContain('value="7"');
    expect(html).toContain('<details class="xz-rule-group"><summary>高级规则</summary>');
    for(const label of ['恢复预设','保存自定义','恢复存档','导出配置','声音设置','外观设置','textarea']) expect(html).not.toContain(label);
    expect(html).toContain('开始血战比赛');expect(html).toContain('电脑1难度');expect(html).toContain('换牌独立时限（秒）');
  });
  it('恢复入口迁至本地菜单',()=>{
    expect(render(<LocalModeMenu onBack={noop} onRiichi={noop} onComingSoon={noop} onResumeXuezhan={noop}/>)).toContain('恢复血战存档');
  });
  it('顶部完整共享槽位、按钮顺序，血战只替换数据和动作',()=>{
    const props={analysisOpen:false,onOpenRulesGuide:noop,onOpenAudioSettings:noop,onToggleAnalysis:noop,onReturnMenu:noop,currentName:'玩家',currentWind:'east' as const,phaseLabel:'打牌'};
    const normal=render(<GameTopBarView {...props}/>),xz=render(<GameTopBarView {...props} information="血战到底" analysisLabel="账本" exitLabel="保存并退出"/>);
    expect(normal.match(/class="[^"]+"/g)).toEqual(xz.match(/class="[^"]+"/g));
    for(const html of [normal,xz]) expect(html.indexOf('音乐设置')).toBeLessThan(html.indexOf('规则说明'));
    expect(xz.indexOf('规则说明')).toBeLessThan(xz.indexOf('账本'));
    expect(xz.indexOf('账本')).toBeLessThan(xz.indexOf('保存并退出'));
  });
});

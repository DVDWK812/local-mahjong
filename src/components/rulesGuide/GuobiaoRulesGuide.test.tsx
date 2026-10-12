import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GB_FAN_CATALOG } from '../../game/guobiao/fanCatalog';
import { GB_GUIDE_EXAMPLES,guideInput,GB_GUIDE_CASES,GB_GUIDE_EXCLUSIONS,GB_GUIDE_SECTIONS } from '../../game/guobiao/guideContent';
import { scoreGb } from '../../game/guobiao/scoring';
import { createGbConfig } from '../../game/guobiao/config';
import { GuobiaoRulesGuide } from './GuobiaoRulesGuide';
import { GuobiaoSettings } from '../GuobiaoSettings';
describe('国标统一教程与固定教学案例',()=>{
 it('完整81 ID/番值沿用冻结目录，每例物理合法并成立目标番',()=>{expect(GB_GUIDE_EXAMPLES).toHaveLength(81);expect(new Set(GB_GUIDE_EXAMPLES.map(f=>f.id))).toEqual(new Set(GB_FAN_CATALOG.map(f=>f.id)));for(const ex of GB_GUIDE_EXAMPLES){const actual=scoreGb(guideInput(ex));const f=GB_FAN_CATALOG.find(f=>f.id===ex.id)!;expect(actual.handShapeValid,ex.id).toBe(true);expect(actual.fanItems.find(i=>i.id===ex.id)?.value,ex.id).toBe(f.value);expect(GB_GUIDE_EXCLUSIONS[ex.id],ex.id).toBeTruthy();}});
 for(const c of GB_GUIDE_CASES)it(c.title,()=>{const actual=scoreGb(c.input);expect(actual.handShapeValid).toBe(true);expect(actual.nonFlowerFan).toBe(c.expected.nonFlower);expect(actual.totalFan).toBe(c.expected.total);expect(actual.canHu).toBe(c.expected.canHu);});
 it('无番和自摸不能把1番填成8',()=>{const c=GB_GUIDE_CASES.find(c=>c.id==='chicken')!;const actual=scoreGb({...c.input,selfDraw:true,source:'live'});expect(actual.nonFlowerFan).toBe(1);expect(actual.canHu).toBe(false);expect(actual.fanItems.some(f=>f.id==='CHICKEN_HAND')).toBe(false);});
 it('新手十个主题与模态容器；不新建Canvas',()=>{expect(GB_GUIDE_SECTIONS.map(s=>s.id)).toEqual(['flow','tiles','shapes','actions','flowers','fansIntro','combination','payment','operations']);const html=renderToStaticMarkup(<GuobiaoRulesGuide config={createGbConfig()} onBack={()=>{}}/>);expect(html).toContain('aria-modal="true"');expect(html).toContain('从零开始的一盘');expect(html).toContain('完整81番种检索');expect(html).not.toContain('<canvas');});
 it('设置保留有效控件，规则按钮在预设之前，删除两处长文',()=>{const html=renderToStaticMarkup(<GuobiaoSettings onBack={()=>{}} onStart={()=>{}} onResume={()=>{}}/>);expect(html.indexOf('比赛规则')).toBeLessThan(html.indexOf('比赛预设'));expect(html).not.toContain('规则与数字版说明');expect(html).not.toContain('WMO 官网');for(const text of ['电脑设置','恢复国标比赛','查看最近国标牌谱','开始游戏'])expect(html).toContain(text);});
});

import { describe, it, expect } from 'vitest';
import type { TileId } from '../types';
import { decomposeGb } from './shapes';
import { scoreGb, GB_FAN_CATALOG, type GbScoringInput } from './scoring';
import type { GbGroup } from './types';
export function gbIds(text:string):TileId[]{const ids:TileId[]=[];for(const part of text.split(' ')){const suit=part[part.length-1];
  if('mps'.includes(suit)){for(const n of part.slice(0,-1))ids.push((Number(n)-1+'mps'.indexOf(suit)*9) as TileId);}
  else for(const ch of part)ids.push((27+'ESWN PFC'.replace(' ','').indexOf(ch)) as TileId);
}return ids;}
export const group=(text:string,kind:GbGroup['kind']='chi',opened=true):GbGroup=>({kind,ids:gbIds(text),opened,fixed:true});
export function input(before:string,win:string,melds:GbGroup[]=[],extras:Partial<GbScoringInput>={}):GbScoringInput{return{concealed:gbIds(before),winningTile:gbIds(win)[0],melds,selfDraw:false,seatWind:1,roundWind:0,flowers:0,source:'discard',lastWall:false,visibleOtherCopies:0,...extras};}
describe('GB-3 独立人工固定算例（WMO中文附件一/9.1）',()=>{
  it('牌形枚举和物理张数保护',()=>{expect(decomposeGb(gbIds('111222333m 456p 55s')).length).toBeGreaterThan(1);expect(decomposeGb(gbIds('11111m 123p 123s EEE'))).toEqual([]);});
  it('完整81番表保持版本双暗杠8',()=>{expect(GB_FAN_CATALOG).toHaveLength(81);expect(GB_FAN_CATALOG.find(f=>f.id==='TWO_CONCEALED_KONGS')?.value).toBe(8);});
  it('三杠加一个暗杠：37',()=>{const r=scoreGb(input('12s 55p','3s',[group('1111m','kan',false),group('2222p','kan'),group('3333p','kan')]));expect(r.nonFlowerFan).toBe(37);});
  it('四杠双暗杠，不重复双暗刻：98',()=>{const r=scoreGb(input('5p','5p',[group('1111m','kan',false),group('2222p','kan',false),group('3333p','kan'),group('4444s','kan')]));expect(r.nonFlowerFan).toBe(98);expect(r.fanItems.some(f=>f.id==='TWO_CONCEALED_PUNGS')).toBe(false);});
  it('三色双龙会不依赖副露顺序：22',()=>{const r=scoreGb(input('5s','5s',[group('123m'),group('123p'),group('789m'),group('789p')]));expect(r.nonFlowerFan).toBe(22);});
  it('一色双龙会全求人：70',()=>{expect(scoreGb(input('5m','5m',[group('123m'),group('789m'),group('123m'),group('789m')])).nonFlowerFan).toBe(70);});
  it('单调将不可按其他花色同点数误算坎张',()=>{const r=scoreGb(input('123456m 789s CCC 2p','2p'));expect(r.fanItems.some(f=>f.id==='SINGLE_WAIT')).toBe(true);expect(r.fanItems.some(f=>f.id==='CLOSED_WAIT')).toBe(false);});
  it('有副露组合龙：15',()=>{expect(scoreGb(input('147m 258p 369s 5p','5p',[group('CCC','pon')])).nonFlowerFan).toBe(15);});
  it('补花仅自摸，不冒充杠上开花',()=>{const r=scoreGb(input('123456789m 111p 2s','2s',[],{source:'flower',selfDraw:true,flowers:1}));expect(r.canHu).toBe(true);expect(r.fanItems.some(f=>f.id==='OUT_WITH_REPLACEMENT_TILE')).toBe(false);expect(r.totalFan).toBe(r.nonFlowerFan+1);});
  it('非花7加1花不能和；自摸8可和',()=>{const before='34m 678m WWW 55m',melds=[group('789m')];
    const r=scoreGb(input(before,'2m',melds,{flowers:1}));expect(r.handShapeValid).toBe(true);expect(r.nonFlowerFan).toBe(7);expect(r.canHu).toBe(false);expect(r.fanItems.some(f=>f.id==='CHICKEN_HAND')).toBe(false);
    const tsumo=scoreGb(input(before,'2m',melds,{flowers:1,selfDraw:true,source:'live'}));expect(tsumo.nonFlowerFan).toBe(8);expect(tsumo.totalFan).toBe(9);expect(tsumo.canHu).toBe(true);});
  it('十三幺点和88，自摸加不求人4',()=>{expect(scoreGb(input('19m 19p 19s ESWNPFC','1m')).nonFlowerFan).toBe(88);expect(scoreGb(input('19m 19p 19s ESWNPFC','1m',[],{selfDraw:true,source:'live'})).nonFlowerFan).toBe(92);});
  it('四归一在国标七对中允许两对相同牌',()=>{const r=scoreGb(input('1111m 22p 33p 44s 55s E','E'));expect(r.canHu).toBe(true);expect(r.fanItems.find(f=>f.id==='TILE_HOG')?.count).toBe(1);});
  it('三暗杠加三暗刻，不再重复双暗杠：53',()=>{expect(scoreGb(input('123s 5p','5p',[group('1111m','kan',false),group('2222p','kan',false),group('4444p','kan',false)])).nonFlowerFan).toBe(53);});
  it('四暗杠加四暗刻，不再重复双暗杠：154',()=>{expect(scoreGb(input('5p','5p',[group('1111m','kan',false),group('2222p','kan',false),group('4444p','kan',false),group('5555s','kan',false)])).nonFlowerFan).toBe(154);});
  it('正好结构数量内的第五张物理牌仍拒绝',()=>{expect(scoreGb(input('11111m 123p 456s EE','E')).handShapeValid).toBe(false);});
  it('部分幺九刻排除保留准确参与组和排除次数',()=>{const r=scoreGb(input('123m 456p 111s CCC 5p','5p'));const p=r.fanItems.find(f=>f.id==='PUNG_OF_TERMINALS_OR_HONORS')!;
    expect(p.groups).toEqual([2]);expect(p.count).toBe(1);expect(r.excludedItems.find(f=>f.id===p.id)?.reason).toContain('排除1次');});
  it('三风刻排除的风牌不能再列为剩余幺九刻参与组',()=>{const r=scoreGb(input('EEE SSS WWW 111m 5p','5p'));const f=r.fanItems.find(i=>i.id==='PUNG_OF_TERMINALS_OR_HONORS')!;expect(f.count).toBe(1);expect(f.groups).toEqual([0]);});
  it('固定吃碰必须明露；不能伪造门前清',()=>{for(const [tiles,kind]of [['123m','chi'],['111m','pon']]as const){const f=input('123p 123s 789m 5p','5p',[group(tiles,kind,false)]);expect(scoreGb(f).handShapeValid).toBe(false);expect(scoreGb({...f,melds:[group(tiles,kind,true)]}).handShapeValid).toBe(true);}});
});


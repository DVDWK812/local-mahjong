import { describe, expect, it } from 'vitest';
import { matchLengthForChoice, pathLabel, presetForChoice } from './navigation';

describe('页面导航配置', () => {
  it('四人东加载东风场配置', () => {
    expect(matchLengthForChoice('four-east')).toBe('east-only');
    expect(presetForChoice('four-east')).toBe('east-round');
  });

  it('四人南加载南风场配置', () => {
    expect(matchLengthForChoice('four-south')).toBe('hanchan');
    expect(presetForChoice('four-south')).toBe('south-round');
  });

  it('规则设置路径显示完整选择', () => {
    expect(pathLabel({ playerCount: 4, lengthChoice: 'four-east' })).toBe('本地模式 ＞ 立直麻将 ＞ 四人间 ＞ 四人东');
    expect(pathLabel({ playerCount: 4, lengthChoice: 'four-south' })).toBe('本地模式 ＞ 立直麻将 ＞ 四人间 ＞ 四人南');
  });

  it('三人间预留路径但不改变当前四人实现', () => {
    expect(matchLengthForChoice('three-east')).toBe('east-only');
    expect(pathLabel({ playerCount: 3, lengthChoice: 'three-south' })).toBe('本地模式 ＞ 立直麻将 ＞ 三人间 ＞ 三人南');
  });
});

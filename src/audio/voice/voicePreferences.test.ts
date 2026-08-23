import { describe, expect, it } from 'vitest';
import {
  normalizeVoiceSeatAssignments,
  resolveSeatIndexForActor,
  resolveVoicePackForActor,
  resolveVoiceSeatAssignments,
} from './voicePreferences';

const packs = [
  { id: 'xiaozhang', name: '校长', locale: 'zh-CN', path: 'xiaozhang' },
  { id: 'mambo', name: '曼波', locale: 'zh-CN', path: 'mambo' },
  { id: 'robot', name: '机器人', locale: 'zh-CN', path: 'robot' },
  { id: 'master', name: '大师', locale: 'zh-CN', path: 'master' },
];

describe('voice seat preferences', () => {
  it('持久化四个稳定玩家 slot，并忽略多余或无效值', () => {
    expect(normalizeVoiceSeatAssignments(['xiaozhang', ' mambo ', null, 42, 'ignored'])).toEqual(['xiaozhang', 'mambo', null, null]);
  });

  it('actorId 根据当前玩家顺序映射座位，而不是直接等于 seatIndex', () => {
    expect(resolveSeatIndexForActor('player-b', { playerIds: ['player-a', 'player-b', 'player-c', 'player-d'], playerCount: 4 })).toBe(1);
    expect(resolveSeatIndexForActor('3', { playerIds: [42, 7, 91, 3], playerCount: 4 })).toBe(3);
  });

  it('二人、三人与四人只解析当前活跃座位', () => {
    const assignments = ['xiaozhang', 'mambo', 'robot', 'master'] as const;
    expect(resolveVoicePackForActor('p2', { playerIds: ['p1', 'p2'], playerCount: 2 }, assignments, 'xiaozhang', packs)).toBe('mambo');
    expect(resolveVoicePackForActor('p3', { playerIds: ['p1', 'p2', 'p3', 'p4'], playerCount: 3 }, assignments, 'xiaozhang', packs)).toBe('robot');
    expect(resolveVoicePackForActor('p4', { playerIds: ['p1', 'p2', 'p3', 'p4'], playerCount: 3 }, assignments, 'xiaozhang', packs)).toBe('xiaozhang');
  });

  it('删除角色后的 assignment 自动清理，并回退默认角色', () => {
    const assignments = resolveVoiceSeatAssignments(['xiaozhang', 'mambo', 'robot', 'master'], packs.filter((pack) => pack.id !== 'mambo'));
    expect(assignments).toEqual(['xiaozhang', null, 'robot', 'master']);
    expect(resolveVoicePackForActor('p2', { playerIds: ['p1', 'p2', 'p3', 'p4'], playerCount: 4 }, assignments, 'xiaozhang', packs.filter((pack) => pack.id !== 'mambo'))).toBe('xiaozhang');
  });

  it('四人切换至三人或二人后不会删除隐藏座位配置', () => {
    const assignments = normalizeVoiceSeatAssignments(['xiaozhang', 'mambo', 'robot', 'master']);
    resolveVoicePackForActor('p2', { playerIds: ['p1', 'p2'], playerCount: 2 }, assignments, 'xiaozhang', packs);
    expect(assignments[2]).toBe('robot');
    expect(assignments[3]).toBe('master');
  });
});

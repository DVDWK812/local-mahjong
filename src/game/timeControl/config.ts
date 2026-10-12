export type MatchMode = 'four' | 'seventeen' | 'xuezhan' | 'sanma' | 'guobiao';
export type TurnClockConfig = { readonly kind: 'unlimited' } | { readonly kind: 'banked'; readonly decisionBaseMs: number; readonly bankPerHandMs: number };
export type SelectionClockConfig = { readonly kind: 'unlimited' } | { readonly kind: 'fixed'; readonly durationMs: number };
export interface TimeControlConfig {
  readonly schemaVersion: 1;
  readonly turn: TurnClockConfig;
  readonly seventeenSelection?: SelectionClockConfig;
  readonly preparation?: Readonly<Record<'exchange' | 'missing', SelectionClockConfig>>;
}
export const TIME_LIMITS = { baseMaxMs: 300_000, bankMaxMs: 3_600_000, selectionMaxMs: 3_600_000 } as const;
export const INFRA_V1_ENABLED = { four: true, seventeen: true, xuezhan: true, sanma: true, guobiao: true } as const;
export const SELECTION_MINUTES = [1, 2, 3, 5] as const;
/** Rollout applies to new matches only; restoring an existing snapshot bypasses this switch. */
export function newMatchTimeControl(input: TimeControlConfig, mode: MatchMode): TimeControlConfig {
  return INFRA_V1_ENABLED[mode] ? snapshotTimeControl(input, mode) : unlimitedTimeControl(mode);
}
export function defaultTimeControl(mode: MatchMode): TimeControlConfig {
  return snapshotTimeControl({ schemaVersion: 1, turn: { kind: 'banked', decisionBaseMs: 5000, bankPerHandMs: 20000 },
    ...(mode === 'seventeen' ? { seventeenSelection: { kind: 'fixed', durationMs: 120000 } } : {}),
    ...(mode === 'xuezhan' ? { preparation: { exchange: { kind: 'fixed', durationMs: 30000 }, missing: { kind: 'fixed', durationMs: 10000 } } } : {}) }, mode);
}
export function unlimitedTimeControl(mode: MatchMode): TimeControlConfig {
  return snapshotTimeControl({ schemaVersion: 1, turn: { kind: 'unlimited' },
    ...(mode === 'seventeen' ? { seventeenSelection: { kind: 'unlimited' } } : {}),
    ...(mode === 'xuezhan' ? { preparation: { exchange: { kind: 'unlimited' }, missing: { kind: 'unlimited' } } } : {}) }, mode);
}
function milliseconds(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`时间必须为 ${min / 1000}～${max / 1000} 秒内的有效数值`);
  return value;
}
/** All start/restore paths validate here; never silently coerce invalid input. */
export function snapshotTimeControl(input: unknown, mode: MatchMode): TimeControlConfig {
  const value = input as TimeControlConfig | undefined;
  if (!value || value.schemaVersion !== 1) throw new Error('不支持的时间配置版本');
  const turn: TurnClockConfig = value.turn?.kind === 'unlimited' ? { kind: 'unlimited' }
    : value.turn?.kind === 'banked' ? { kind: 'banked', decisionBaseMs: milliseconds(value.turn.decisionBaseMs, 1, TIME_LIMITS.baseMaxMs), bankPerHandMs: milliseconds(value.turn.bankPerHandMs, 0, TIME_LIMITS.bankMaxMs) }
    : (() => { throw new Error('出牌时间配置无效'); })();
  if (mode !== 'seventeen' && value.seventeenSelection !== undefined) throw new Error('当前比赛不能包含17步选牌时间');
  const selection = value.seventeenSelection;
  if (mode !== 'xuezhan' && value.preparation !== undefined) throw new Error('当前模式不支持换牌定缺时间');
  const preparation = mode === 'xuezhan' ? Object.fromEntries(['exchange', 'missing'].map(key => {
    const phase = value.preparation?.[key as 'exchange' | 'missing'];
    if (!phase || !['fixed', 'unlimited'].includes(phase.kind)) throw new Error('准备阶段时间配置无效');
    return [key, Object.freeze(phase.kind === 'fixed' ? { kind: 'fixed' as const, durationMs: milliseconds(phase.durationMs, 1, TIME_LIMITS.selectionMaxMs) } : { kind: 'unlimited' as const })];
  })) as TimeControlConfig['preparation'] : undefined;
  if (mode === 'seventeen' && selection?.kind !== 'unlimited' && selection?.kind !== 'fixed') throw new Error('选牌时间配置无效');
  return Object.freeze({ schemaVersion: 1, turn: Object.freeze(turn), ...(preparation ? { preparation: Object.freeze(preparation) } : {}), ...(mode === 'seventeen' ? {
    seventeenSelection: Object.freeze(selection?.kind === 'fixed' ? { kind: 'fixed' as const, durationMs: milliseconds(selection.durationMs, 1, TIME_LIMITS.selectionMaxMs) } : { kind: 'unlimited' as const }),
  } : {}) });
}
export function loadTimeDraft(mode: MatchMode, storage?: Pick<Storage, 'getItem'>): TimeControlConfig {
  try {
    const raw = storage?.getItem(`local-mahjong.time-control.${mode}.v1`);
    if (raw) {
      const config = snapshotTimeControl(JSON.parse(raw), mode);
      const selection = config.seventeenSelection;
      // Presets apply to new-match drafts only, never to running/saved matches.
      if (mode === 'seventeen' && (selection?.kind !== 'fixed' || !SELECTION_MINUTES.some(minutes => minutes * 60000 === selection.durationMs))) {
        return snapshotTimeControl({ ...config, seventeenSelection: { kind: 'fixed', durationMs: 120000 } }, mode);
      }
      return config;
    }
  } catch { /* isolate corrupt drafts */ }
  return defaultTimeControl(mode);
}
export function saveTimeDraft(mode: MatchMode, value: TimeControlConfig, storage?: Pick<Storage, 'setItem'>): void {
  try { storage?.setItem(`local-mahjong.time-control.${mode}.v1`, JSON.stringify(snapshotTimeControl(value, mode))); } catch { /* in-memory editing remains available */ }
}

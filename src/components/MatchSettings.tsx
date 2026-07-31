import { useState } from 'react';
import { validateRuleConfig, type RulePresetId } from '../game/match/matchRules';
import type { FullRuleConfig, MaxExtraRoundWind } from '../game/match/types';
import type { RuleDescriptionKey } from '../game/rules/ruleDescriptions';
import { RuleHelpTooltip } from './RuleHelpTooltip';

export type AIDifficulty = 'chikukon' | 'shintentai' | 'upper' | 'kishin';
export type AIPersonality = 'defensive' | 'aggressive' | 'balanced';

export interface AIPlayerSetting {
  playerId: 1 | 2 | 3;
  difficulty: AIDifficulty;
  personality: AIPersonality;
}

export const DEFAULT_AI_PLAYER_SETTINGS: AIPlayerSetting[] = ([1, 2, 3] as const).map((playerId) => ({
  playerId,
  difficulty: 'chikukon',
  personality: 'balanced',
}));

const AI_DIFFICULTY_OPTIONS: Array<{ value: AIDifficulty; label: string }> = [
  { value: 'chikukon', label: '筑根（简单）' },
  { value: 'shintentai', label: '心转手（中等）' },
  { value: 'upper', label: '上层（难）' },
  { value: 'kishin', label: '鬼神（地狱）' },
];

const AI_PERSONALITY_OPTIONS: Array<{ value: AIPersonality; label: string }> = [
  { value: 'defensive', label: '沉稳老练（防守向）' },
  { value: 'aggressive', label: '锋芒毕露（进攻向）' },
  { value: 'balanced', label: '稳步进取（平衡向）' },
];

interface MatchSettingsProps {
  config: FullRuleConfig;
  presetId?: RulePresetId;
  matchTypeLabel?: string;
  pathLabel?: string;
  doraGlowEnabled?: boolean;
  sameTileHoverEnabled?: boolean;
  showTenpaiWaitsEnabled?: boolean;
  tsumoGiriDisplayEnabled?: boolean;
  aiPlayerSettings?: AIPlayerSetting[];
  onPresetChange?: (preset: RulePresetId, config: FullRuleConfig) => void;
  onDoraGlowChange?: (enabled: boolean) => void;
  onSameTileHoverChange?: (enabled: boolean) => void;
  onShowTenpaiWaitsChange?: (enabled: boolean) => void;
  onTsumoGiriDisplayChange?: (enabled: boolean) => void;
  onAIPlayerSettingsChange?: (settings: AIPlayerSetting[]) => void;
  onConfigChange: (config: FullRuleConfig) => void;
}

export function normalizeMatchSettingsConfig(
  config: FullRuleConfig,
  matchPatch: Partial<FullRuleConfig['match']> = {},
  roundPatch: Partial<FullRuleConfig['round']> = {},
): FullRuleConfig {
  const rawMatch = {
    ...config.match,
    ...matchPatch,
    matchLength: config.match.matchLength,
    matchCount: normalizeMatchCount(matchPatch.matchCount ?? config.match.matchCount),
    bankruptcyThreshold: 0,
    agariYameMode: 'automatic' as const,
    tenpaiYameMode: 'automatic' as const,
  };
  const match = {
    ...rawMatch,
    maxExtraRoundWind: normalizeMaxExtraRoundWind(rawMatch.matchLength, rawMatch.maxExtraRoundWind),
  };

  return {
    round: {
      ...config.round,
      preserveClaimedDiscardGap: config.round.preserveClaimedDiscardGap ?? false,
      tripleRonMode: config.round.tripleRonMode ?? 'allow',
      ...roundPatch,
    },
    match: {
      ...match,
      suddenDeathTarget: match.targetPoints,
    },
  };
}

function normalizeMaxExtraRoundWind(matchLength: FullRuleConfig['match']['matchLength'], value: MaxExtraRoundWind): MaxExtraRoundWind {
  if (value === 'none') return 'none';
  if (matchLength === 'hanchan' && value === 'south') return 'west';
  return value;
}

function defaultMaxExtraRoundWind(matchLength: FullRuleConfig['match']['matchLength']): MaxExtraRoundWind {
  return matchLength === 'hanchan' ? 'west' : 'south';
}

export function MatchSettings({
  config,
  matchTypeLabel,
  pathLabel,
  doraGlowEnabled = true,
  sameTileHoverEnabled = true,
  showTenpaiWaitsEnabled = true,
  tsumoGiriDisplayEnabled = true,
  aiPlayerSettings = DEFAULT_AI_PLAYER_SETTINGS,
  onDoraGlowChange,
  onSameTileHoverChange,
  onShowTenpaiWaitsChange,
  onTsumoGiriDisplayChange,
  onAIPlayerSettingsChange,
  onConfigChange,
}: MatchSettingsProps) {
  const validation = validateRuleConfig(config);
  const match = config.match;
  const round = config.round;
  const resolvedMatchType = matchTypeLabel ?? (match.matchLength === 'east-only' ? '四人东' : '四人南');

  const setMatch = (patch: Partial<typeof match>) => {
    onConfigChange(normalizeMatchSettingsConfig(config, patch));
  };
  const setRound = (patch: Partial<typeof round>) => {
    onConfigChange(normalizeMatchSettingsConfig(config, {}, patch));
  };
  const setAIPlayer = (playerId: AIPlayerSetting['playerId'], patch: Partial<Omit<AIPlayerSetting, 'playerId'>>) => {
    onAIPlayerSettingsChange?.(aiPlayerSettings.map((setting) =>
      setting.playerId === playerId ? { ...setting, ...patch } : setting));
  };

  return (
    <section className="match-settings">
      <section className="settings-block">
        <h2>比赛信息</h2>
        <div className="settings-info-grid">
          <div>
            <span>当前路径</span>
            <strong>{pathLabel ?? `本地模式 ＞ 立直麻将 ＞ 四人间 ＞ ${resolvedMatchType}`}</strong>
          </div>
          <div>
            <span>比赛类型</span>
            <strong>{resolvedMatchType}</strong>
          </div>
        </div>
      </section>

      <section className="settings-block ai-settings-block">
        <h3>AI难度</h3>
        <p className="ai-settings-note">分别设置三名 AI 玩家；当前仅保留训练档位与性格配置，不改变现有 AI 行为。</p>
        <div className="ai-settings-list">
          {aiPlayerSettings.map((setting) => (
            <div className="ai-setting-row" key={setting.playerId}>
              <strong>AI 玩家 {setting.playerId + 1}</strong>
              <label className="settings-field">
                <span>难度</span>
                <select
                  aria-label={`AI 玩家 ${setting.playerId + 1} 难度`}
                  value={setting.difficulty}
                  onChange={(event) => setAIPlayer(setting.playerId, { difficulty: event.target.value as AIDifficulty })}
                >
                  {AI_DIFFICULTY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="settings-field">
                <span>性格</span>
                <select
                  aria-label={`AI 玩家 ${setting.playerId + 1} 性格`}
                  value={setting.personality}
                  onChange={(event) => setAIPlayer(setting.playerId, { personality: event.target.value as AIPersonality })}
                >
                  {AI_PERSONALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-block">
        <h3>点数与比赛场数</h3>
        <div className="settings-grid settings-grid--four">
          <NumberField label="起始点数" rule="startingPoints" value={match.startingPoints} onChange={(value) => setMatch({ startingPoints: value })} />
          <NumberField label="目标点数" rule="targetPoints" value={match.targetPoints} onChange={(value) => setMatch({ targetPoints: value })} />
          <NumberField label="返还点" rule="returnPoints" value={match.returnPoints} onChange={(value) => setMatch({ returnPoints: value })} />
          <NumberField label="比赛场数" rule="matchCount" value={match.matchCount} min={1} max={4} onChange={(value) => setMatch({ matchCount: normalizeMatchCount(value) })} />
        </div>
      </section>

      <section className="settings-block">
        <div className="settings-grid settings-grid--four">
          {match.allowWestRound ? (
            <label className="settings-field">
              <FieldTitle label="最大延长场风" rule="maxExtraRoundWind" />
              <select value={normalizeMaxExtraRoundWind(match.matchLength, match.maxExtraRoundWind)} onChange={(event) => setMatch({ maxExtraRoundWind: event.target.value as typeof match.maxExtraRoundWind })}>
                <option value="none">不延长</option>
                {match.matchLength === 'east-only' ? <option value="south">南</option> : null}
                <option value="west">西</option>
                <option value="north">北</option>
              </select>
            </label>
          ) : null}
          <label className="settings-field">
            <FieldTitle label="残余供托" rule="leftoverRiichiStickMode" />
            <select value={match.leftoverRiichiStickMode} onChange={(event) => setMatch({ leftoverRiichiStickMode: event.target.value as typeof match.leftoverRiichiStickMode })}>
              <option value="first-place">第一名</option>
              <option value="initial-dealer">起庄</option>
              <option value="discard">不分配</option>
            </select>
          </label>
        </div>
      </section>

      <section className="settings-block">
        <h3>整场规则</h3>
        <div className="settings-check-grid">
          <CheckField label="击飞结束" rule="bankruptcyEndsMatch" checked={match.bankruptcyEndsMatch} onChange={(checked) => setMatch({ bankruptcyEndsMatch: checked })} />
          <CheckField label="和牌止" rule="agariYame" checked={match.agariYame} onChange={(checked) => setMatch({ agariYame: checked })} />
          <CheckField label="听牌止" rule="tenpaiYame" checked={match.tenpaiYame} onChange={(checked) => setMatch({ tenpaiYame: checked })} />
          <CheckField
            label="延长局"
            rule="allowWestRound"
            checked={match.allowWestRound}
            onChange={(checked) => setMatch({ allowWestRound: checked, maxExtraRoundWind: checked ? (match.maxExtraRoundWind === 'none' ? defaultMaxExtraRoundWind(match.matchLength) : match.maxExtraRoundWind) : 'none' })}
          />
          <CheckField label="马点" rule="useUma" checked={match.useUma} onChange={(checked) => setMatch({ useUma: checked })} />
          <CheckField label="头跳（截和）" rule="useOka" checked={match.useOka} onChange={(checked) => setMatch({ useOka: checked })} />
        </div>
      </section>

      {match.useUma ? (
        <section className="settings-block">
          <h3>马点设置</h3>
          <UmaFields uma={match.uma} onRewardsChange={(firstReward, secondReward) => setMatch({ uma: buildUma(firstReward, secondReward) })} />
        </section>
      ) : null}

      <section className="settings-block">
        <h3>单局规则</h3>
        <div className="settings-check-grid settings-check-grid--round">
          <CheckField label="食断" rule="allowOpenTanyao" checked={round.allowOpenTanyao} onChange={(checked) => setRound({ allowOpenTanyao: checked })} />
          <CheckField label="赤宝牌" rule="akaDora" checked={round.akaDora} onChange={(checked) => setRound({ akaDora: checked })} />
          <CheckField label="一发" rule="ippatsu" checked={round.ippatsu} onChange={(checked) => setRound({ ippatsu: checked })} />
          <CheckField label="双倍役满" rule="allowDoubleYakuman" checked={round.allowDoubleYakuman} onChange={(checked) => setRound({ allowDoubleYakuman: checked })} />
          <CheckField label="多倍役满" rule="multipleYakuman" checked={round.multipleYakuman} onChange={(checked) => setRound({ multipleYakuman: checked })} />
          <CheckField label="古役" rule="allowAncientYaku" checked={round.allowAncientYaku} onChange={(checked) => setRound({ allowAncientYaku: checked })} />
          <CheckField label="切上满贯" rule="kiriageMangan" checked={round.kiriageMangan} onChange={(checked) => setRound({ kiriageMangan: checked })} />
          <CheckField label="连风雀符" rule="doubleWindPairFu" checked={round.doubleWindPairFu} onChange={(checked) => setRound({ doubleWindPairFu: checked })} />
          <CheckField label="九种九牌" rule="allowKyuushuKyuuhai" checked={round.allowKyuushuKyuuhai} onChange={(checked) => setRound({ allowKyuushuKyuuhai: checked })} />
          <CheckField label="四风连打" rule="abortOnFourWinds" checked={round.abortOnFourWinds} onChange={(checked) => setRound({ abortOnFourWinds: checked })} />
          <CheckField label="四家立直" rule="abortOnFourRiichi" checked={round.abortOnFourRiichi} onChange={(checked) => setRound({ abortOnFourRiichi: checked })} />
          <CheckField label="四杠散了" rule="abortOnFourKans" checked={round.abortOnFourKans} onChange={(checked) => setRound({ abortOnFourKans: checked })} />
          <CheckField label="三家和" rule="tripleRonMode" checked={round.tripleRonMode !== 'abortive-draw'} onChange={(checked) => setRound({ tripleRonMode: checked ? 'allow' : 'abortive-draw' })} />
          <CheckField label="国士无双抢暗杠" rule="allowKokushiChankanAnkan" checked={round.allowKokushiChankanAnkan} onChange={(checked) => setRound({ allowKokushiChankanAnkan: checked })} />
        </div>
      </section>

      <section className="settings-block">
        <h3>辅助显示</h3>
        <div className="settings-check-grid">
          <label className="settings-check">
            <input
              type="checkbox"
              checked={doraGlowEnabled}
              onChange={(event) => onDoraGlowChange?.(event.target.checked)}
            />
            <span>宝牌闪光效果</span>
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={sameTileHoverEnabled}
              onChange={(event) => onSameTileHoverChange?.(event.target.checked)}
            />
            <span>悬停显示相同牌</span>
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={showTenpaiWaitsEnabled}
              onChange={(event) => onShowTenpaiWaitsChange?.(event.target.checked)}
            />
            <span>显示听牌与剩余量</span>
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={tsumoGiriDisplayEnabled}
              onChange={(event) => onTsumoGiriDisplayChange?.(event.target.checked)}
            />
            <span>摸切显示</span>
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={round.preserveClaimedDiscardGap ?? false}
              onChange={(event) => setRound({ preserveClaimedDiscardGap: event.target.checked })}
            />
            <span>鸣牌留空</span>
            <RuleHelpTooltip description="开启后，被吃、碰或杠走的弃牌会在原牌河位置留下空白；关闭时牌河视觉上自动向前补位，但真实弃牌历史仍会保留。" />
          </label>
        </div>
      </section>

      {!validation.valid ? <div className="settings-errors">{validation.errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
    </section>
  );
}

export function buildUma(firstReward: number, secondReward: number): [number, number, number, number] {
  const first = Math.max(0, Math.abs(Number(firstReward) || 0));
  const second = Math.max(0, Math.abs(Number(secondReward) || 0));
  return [first, second, -second, -first];
}

function normalizeMatchCount(value: number): 1 | 2 | 3 | 4 {
  const rounded = Math.round(Number(value) || 1);
  return Math.min(4, Math.max(1, rounded)) as 1 | 2 | 3 | 4;
}

function umaRewards(uma: [number, number, number, number]): [number, number] {
  return [Math.max(0, uma[0]), Math.max(0, uma[1])];
}

function UmaFields({ uma, onRewardsChange }: { uma: [number, number, number, number]; onRewardsChange: (firstReward: number, secondReward: number) => void }) {
  const [firstReward, secondReward] = umaRewards(uma);
  return (
    <div className="uma-reward-fields">
      <label className="settings-field uma-reward-field">
        <span>第一名奖励</span>
        <input type="number" min="0" value={firstReward} onChange={(event) => onRewardsChange(Number(event.target.value), secondReward)} />
      </label>
      <label className="settings-field uma-reward-field">
        <span>第二名奖励</span>
        <input type="number" min="0" value={secondReward} onChange={(event) => onRewardsChange(firstReward, Number(event.target.value))} />
      </label>
    </div>
  );
}

function FieldTitle({ label, rule }: { label: string; rule: RuleDescriptionKey }) {
  return (
    <span className="settings-title">
      <span>{label}</span>
      <RuleHelpTooltip rule={rule} />
    </span>
  );
}

function CheckField({ label, rule, checked, onChange }: { label: string; rule: RuleDescriptionKey; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="settings-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
      <RuleHelpTooltip rule={rule} />
    </label>
  );
}

function NumberField({ label, rule, value, min, max, onChange }: { label: string; rule: RuleDescriptionKey; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return (
    <label className="settings-field">
      <FieldTitle label={label} rule={rule} />
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

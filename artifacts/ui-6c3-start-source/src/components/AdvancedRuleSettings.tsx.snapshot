import type { FullRuleConfig } from '../game/match/types';
import { MatchSettings } from './MatchSettings';

interface AdvancedRuleSettingsProps {
  config: FullRuleConfig;
  onChange: (config: FullRuleConfig) => void;
}

export function AdvancedRuleSettings({ config, onChange }: AdvancedRuleSettingsProps) {
  return <MatchSettings config={config} onConfigChange={onChange} />;
}

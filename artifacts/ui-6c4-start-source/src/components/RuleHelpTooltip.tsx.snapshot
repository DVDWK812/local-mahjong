import { useState } from 'react';
import { ruleDescriptions, type RuleDescriptionKey } from '../game/rules/ruleDescriptions';

interface RuleHelpTooltipProps {
  rule?: RuleDescriptionKey;
  description?: string;
}

export function RuleHelpTooltip({ rule, description }: RuleHelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const helpText = description ?? (rule ? ruleDescriptions[rule] : '');

  return (
    <span className="rule-help">
      <button
        type="button"
        className="rule-help-button"
        aria-label="查看规则说明"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      <span className="rule-help-tooltip" role="tooltip" data-open={open}>
        {helpText}
      </span>
    </span>
  );
}

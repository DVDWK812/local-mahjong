import { useState } from 'react';
import { ruleDescriptions, type RuleDescriptionKey } from '../game/rules/ruleDescriptions';

interface RuleHelpTooltipProps {
  rule: RuleDescriptionKey;
}

export function RuleHelpTooltip({ rule }: RuleHelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const description = ruleDescriptions[rule];

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
        {description}
      </span>
    </span>
  );
}

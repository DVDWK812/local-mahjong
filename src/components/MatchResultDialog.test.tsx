import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { calculateFinalScores } from '../game/match/finalRanking';
import { createMatch } from '../game/match/matchEngine';
import { defaultMatchRuleConfig } from '../game/match/matchRules';
import { MatchResultDialog } from './MatchResultDialog';

describe('MatchResultDialog', () => {
  it('renders final ranking, raw points, converted score, uma, oka, and leftover sticks', () => {
    const match = {
      ...createMatch(),
      phase: 'match-ended' as const,
      finalResult: calculateFinalScores({
        scores: [32400, 30100, 21000, 16500],
        riichiSticks: 1,
        initialDealer: 0,
        ruleConfig: { ...defaultMatchRuleConfig, useUma: true, useOka: true },
        endedBy: 'scheduled-end',
      }),
    };
    const html = renderToStaticMarkup(<MatchResultDialog matchState={match} onNewMatch={() => undefined} />);
    expect(html).toContain('整场结果');
    expect(html).toContain('1位 Player 1');
    expect(html).toContain('33,400点');
    expect(html).toContain('最终比赛分');
    expect(html).toContain('残余供托');
  });
});

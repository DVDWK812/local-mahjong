import type { MatchState } from '../../game/match/types';
import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { presentationPacingGate } from '../../presentation/pacing/PresentationPacingGate';
import type { PresentationEvent } from '../../presentation/PresentationEventBus';
import { getPresentationFeatures } from '../../config/presentationFeatures';
import { presentationEventBus } from '../../presentation/PresentationEventBus';
import { presentationAudioCues } from '../../presentation/PresentationAudioCue';
import type { GameState, TileId, Wind } from '../../game/types';
import {
  buildDoraIndicatorSlots,
  type DoraIndicatorSlot,
} from '../../presentation/table/TablePresentationContract';
import { Tile } from '../Tile';

interface DoraIndicatorStackProps {
  gameState: Pick<GameState, 'doraIndicators' | 'honba' | 'riichiSticks' | 'roundWind'>;
  matchState?: Pick<MatchState, 'roundWind' | 'handNumber'>;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  slots?: readonly DoraIndicatorSlot[];
  summary?: ReactNode;
}

const windNames: Record<Wind, string> = {
  east: '东',
  south: '南',
  west: '西',
  north: '北',
};

function roundText(gameState: DoraIndicatorStackProps['gameState'], matchState?: DoraIndicatorStackProps['matchState']): string {
  const wind = matchState?.roundWind ?? gameState.roundWind;
  const handNumber = matchState?.handNumber ?? 1;
  return `${windNames[wind]}${handNumber}局`;
}

export function DoraIndicatorStack({ gameState, matchState, hoveredTileType = null, sameTileHoverEnabled = true, onHoveredTileTypeChange, slots, summary }: DoraIndicatorStackProps) {
  const indicatorSlots = slots ?? buildDoraIndicatorSlots(gameState.doraIndicators);
  const root = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(() => gameState.doraIndicators.map(tile => tile.instanceId));
  const pending = useRef(new Map<string, { event: PresentationEvent; predecessor?: string; run: ReturnType<typeof presentationAudioCues.run> }>());
  const currentIds = gameState.doraIndicators.map(tile => tile.instanceId);
  const sameHand = revealed.every((id, index) => currentIds[index] === id);
  useLayoutEffect(() => {
    let live = true;
    let lastKan: { eventId: string; sequence: number } | undefined;
    const unsubscribe = presentationEventBus.subscribe(event => {
      if (event.type === 'meld_declared' && event.meldType === 'kan') lastKan = event;
      if (event.type !== 'dora_revealed') return;
      const run = presentationAudioCues.run(event);
      pending.current.set(event.instanceId, { event, run, predecessor: lastKan && event.sequence === lastKan.sequence + 1 ? lastKan.eventId : undefined });
      presentationPacingGate.begin(event);
      void presentationPacingGate.waitUntilClearBefore(event.sequence).then(() => {
        if (live && pending.current.get(event.instanceId)?.event === event) setRevealed(ids => ids.includes(event.instanceId) ? ids : [...ids, event.instanceId]);
      });
    });
    return () => {
      live = false; unsubscribe();
      pending.current.forEach(({ event, run }) => { run.close(); presentationPacingGate.cancel(event.eventId); });
      pending.current.clear();
    };
  }, []);
  useLayoutEffect(() => {
    if (!sameHand) {
      pending.current.forEach(({ event, run }) => { run.close(); presentationPacingGate.cancel(event.eventId); });
      pending.current.clear();
      setRevealed(currentIds);
      return;
    }
    pending.current.forEach(({ event, run, predecessor }, id) => {
      if (!revealed.includes(id)) return;
      // Skipping/cancelling the preceding Kan suppresses unplayed cues; the visual still commits.
      if (!predecessor || presentationAudioCues.hasEmitted(predecessor, 'meld-impact')) run.emit('dora-reveal', 'indicator-commit', 1);
      run.close(); pending.current.delete(id); presentationPacingGate.complete(event.eventId);
    });
  });

  return (
    <aside ref={root} className="dora-indicator-stack" aria-label="宝牌指示牌">
      <span className="dora-indicator-title">宝牌指示牌</span>
      <div className="dora-indicator-slots">
        {indicatorSlots.map(original => {
          const slot = getPresentationFeatures().presentationEvents && original.state === 'revealed' && sameHand && !revealed.includes(original.tile.instanceId)
            ? { state: 'hidden' as const, index: original.index } : original;
          return (
          <span key={slot.state === 'revealed' ? slot.tile.instanceId : `dora-back-${slot.index}`} className="dora-indicator-slot" data-dora-instance={slot.state === 'revealed' ? slot.tile.instanceId : undefined} data-dora-open={slot.state === 'revealed' ? 'true' : 'false'} data-dora-state={slot.state}>
            <Tile tile={slot.state === 'revealed' ? slot.tile : undefined} faceDown={slot.state === 'hidden'} compact doraGlowEnabled={false} hoveredTileType={hoveredTileType} sameTileHoverEnabled={sameTileHoverEnabled} onHoveredTileTypeChange={onHoveredTileTypeChange} />
          </span>
        ); })}
      </div>
      <div className="dora-round-summary">
        {summary ?? <>
        <span>{roundText(gameState, matchState)}　{gameState.honba}本场</span>
        <span>供托{gameState.riichiSticks}</span>
        </>}
      </div>
    </aside>
  );
}

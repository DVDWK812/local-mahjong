import type { CSSProperties } from 'react';
import type { Tile as TileModel } from '../../game/types';
import { resolveHandPresentationSlots, riverOwnsDiscard, type HandPresentationFrame } from '../../presentation/handAnimation/HandPresentationSnapshot';
import type { LocalDiscardMotion } from '../../presentation3d/animation/localDiscardMotion';
import { discardLiftProgress } from '../../presentation3d/animation/discardHandLifecycle';
import { Tile } from '../Tile';

export function LocalHandSnapshot({ frame, concealed, doraIndicators, doraGlowEnabled, doraSweepEnabled }: {
  frame: HandPresentationFrame; concealed: boolean; doraIndicators: TileModel[];
  doraGlowEnabled: boolean; doraSweepEnabled: boolean;
}) {
  const count = frame.snapshot.visualHand.length - (frame.snapshot.drawnTile ? 1 : 0);
  return <div className="local-hand-snapshot-row" data-hand-snapshot={frame.snapshot.eventId}
    data-hand-phase={frame.phase} style={{ '--snapshot-count': count } as CSSProperties}>
    {resolveHandPresentationSlots(frame).map((entry) => <span key={entry.tile.instanceId}
      className="local-hand-snapshot-slot" data-hand-slot-index={entry.index} data-hand-gap={entry.hidden || undefined}
      style={{ visibility: entry.hidden ? 'hidden' : undefined,
        left: `calc(${entry.slot} * (var(--hand-tile-width) + 2px) + ${entry.drawnGap} * var(--drawn-tile-gap))`,
        transform: `translateY(${-entry.lift * 12}px)`,
      }}>
      <Tile tile={concealed ? undefined : entry.tile} faceDown={concealed} interactive={false}
        doraIndicators={doraIndicators} doraGlowEnabled={doraGlowEnabled && !concealed} doraSweepEnabled={doraSweepEnabled} />
    </span>)}
  </div>;
}

export function resolveLocalDiscardRect(frame: HandPresentationFrame, motion: LocalDiscardMotion) {
  const progress = discardLiftProgress(frame);
  const p = progress * progress * (3 - 2 * progress);
  const t = frame.phase === 'lift' ? 0 : frame.phase === 'carry' ? p : 1;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const lift = frame.phase === 'lift' ? p * 12 : frame.phase === 'carry' ? (1 - p) * 12 + Math.sin(Math.PI * p) * 24 : 0;
  return { left: lerp(motion.source.left, motion.destination.left), top: lerp(motion.source.top, motion.destination.top) - lift,
    width: lerp(motion.source.width, motion.destination.width), height: lerp(motion.source.height, motion.destination.height) };
}

export function LocalDiscardProxy({ frame, motion }: { frame: HandPresentationFrame; motion: LocalDiscardMotion }) {
  if (riverOwnsDiscard(frame.phase)) return null;
  return <div className="local-hand-discard-snapshot" data-local-discard-proxy={frame.snapshot.eventId}
    style={resolveLocalDiscardRect(frame, motion)} aria-hidden="true">
    <Tile tile={frame.snapshot.discardedTile} interactive={false} />
  </div>;
}

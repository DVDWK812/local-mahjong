import type { PlayerId, TileId } from '../../game/types';
import type { TileDiscardedPresentationEvent } from '../PresentationEventBus';

export interface PresentationRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface DiscardSourceCapture {
  readonly playerId: PlayerId;
  readonly tileInstanceId: string;
  readonly tile: {
    readonly id: TileId;
    readonly red: boolean;
  };
  readonly sourceTileRect: PresentationRect;
}

export interface DiscardSourceFreshness {
  readonly sessionKey: string;
  readonly confirmedTurn: number;
}

export interface DiscardSourceSnapshot extends DiscardSourceCapture, DiscardSourceFreshness {}

export interface PresentationPoint {
  readonly x: number;
  readonly y: number;
}

export class DiscardSourceSnapshotStore {
  private snapshot: (DiscardSourceSnapshot & { readonly generation: number }) | null = null;
  private generation = 0;

  get hasSnapshot(): boolean {
    return this.snapshot !== null;
  }

  capture(snapshot: DiscardSourceSnapshot): () => void {
    this.generation += 1;
    const generation = this.generation;
    this.snapshot = {
      ...snapshot,
      tile: { ...snapshot.tile },
      sourceTileRect: { ...snapshot.sourceTileRect },
      generation,
    };
    return () => {
      if (this.snapshot?.generation === generation) this.snapshot = null;
    };
  }

  consume(event: TileDiscardedPresentationEvent, freshness: DiscardSourceFreshness): DiscardSourceSnapshot | null {
    const snapshot = this.snapshot;
    this.snapshot = null;
    if (!snapshot) return null;
    if (
      snapshot.playerId !== event.playerId
      || snapshot.tile.id !== event.tile.id
      || snapshot.tile.red !== event.tile.red
      || snapshot.sessionKey !== freshness.sessionKey
      || snapshot.confirmedTurn !== freshness.confirmedTurn
    ) return null;
    const { generation: _generation, ...consumed } = snapshot;
    return consumed;
  }

  clear(): void {
    this.snapshot = null;
  }
}

export function resolveDiscardMotion(
  sourceRect: PresentationRect,
  riverTargetRect: PresentationRect,
  overlayRect: PresentationRect,
): { readonly source: PresentationPoint; readonly destination: PresentationPoint } {
  return {
    source: centerInOverlay(sourceRect, overlayRect),
    destination: centerInOverlay(riverTargetRect, overlayRect),
  };
}

export function centerInOverlay(rect: PresentationRect, overlayRect: PresentationRect): PresentationPoint {
  return {
    x: rect.left + rect.width / 2 - overlayRect.left,
    y: rect.top + rect.height / 2 - overlayRect.top,
  };
}

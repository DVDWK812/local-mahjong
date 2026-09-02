import type { PlayerId, TileId } from '../../game/types';
import type { TileDiscardedPresentationEvent } from '../../presentation/PresentationEventBus';

export type WorldPoint3D = readonly [number, number, number];

export type DiscardSource3DCapture = Readonly<{
  playerId: PlayerId;
  tileInstanceId: string;
  tile: Readonly<{ id: TileId; red: boolean }>;
  position: WorldPoint3D;
  rotationX: number;
  rotationY: number;
  sessionKey: string;
  afterSequence: number;
}>;

export class DiscardSource3DStore {
  private captureValue: (DiscardSource3DCapture & { generation: number }) | null = null;
  private generation = 0;

  get hasCapture(): boolean {
    return this.captureValue !== null;
  }

  capture(capture: DiscardSource3DCapture): () => void {
    this.generation += 1;
    const generation = this.generation;
    this.captureValue = {
      ...capture,
      tile: { ...capture.tile },
      position: [...capture.position],
      generation,
    };
    return () => {
      if (this.captureValue?.generation === generation) this.captureValue = null;
    };
  }

  consume(
    event: TileDiscardedPresentationEvent,
    sessionKey: string,
  ): DiscardSource3DCapture | null {
    const capture = this.captureValue;
    this.captureValue = null;
    if (!capture) return null;
    if (
      capture.playerId !== event.playerId
      || capture.tile.id !== event.tile.id
      || capture.tile.red !== event.tile.red
      || capture.sessionKey !== sessionKey
      || event.sequence !== capture.afterSequence + 1
    ) return null;
    const { generation: _generation, ...value } = capture;
    return value;
  }

  clear(): void {
    this.captureValue = null;
  }
}

import { describe, expect, it, vi } from 'vitest';
import { PresentationEventBus } from '../presentation/PresentationEventBus';
import { AudioPresentationConsumer } from './AudioPresentationConsumer';

describe('AudioPresentationConsumer', () => {
  it('把 confirmed TileDiscarded 映射为一次 discard SFX', () => {
    const bus = new PresentationEventBus();
    const playSfx = vi.fn();
    const consumer = new AudioPresentationConsumer({ playSfx }, bus);
    bus.publish({
      type: 'tile_discarded',
      playerId: 0,
      tile: { id: 0, red: false },
      riverIndex: 0,
      isRiichiDiscard: false,
    });
    expect(playSfx).toHaveBeenCalledOnce();
    expect(playSfx).toHaveBeenCalledWith('discard');
    consumer.dispose();
  });

  it('Test Mode / Replay policy 关闭时不播放，重新允许后只处理新事件', () => {
    let enabled = false;
    const bus = new PresentationEventBus();
    const playSfx = vi.fn();
    const consumer = new AudioPresentationConsumer({ playSfx }, bus, () => enabled);
    const input = {
      type: 'tile_discarded' as const,
      playerId: 0 as const,
      tile: { id: 1 as const, red: false },
      riverIndex: 0,
      isRiichiDiscard: false,
    };
    bus.publish(input);
    enabled = true;
    bus.publish({ ...input, riverIndex: 1 });
    expect(playSfx).toHaveBeenCalledTimes(1);
    consumer.dispose();
    bus.publish({ ...input, riverIndex: 2 });
    expect(playSfx).toHaveBeenCalledTimes(1);
  });
});

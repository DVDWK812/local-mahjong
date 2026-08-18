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

  it('riichi_declared 不播放假音效，也不重复 discard SFX', () => {
    const bus = new PresentationEventBus();
    const playSfx = vi.fn();
    const consumer = new AudioPresentationConsumer({ playSfx }, bus);

    bus.publish({ type: 'riichi_declared', playerId: 0, riverIndex: 2 });

    expect(playSfx).not.toHaveBeenCalled();
    consumer.dispose();
  });

  it('meld_declared 不播放未提供的 chi / pon / kan SFX', () => {
    const bus = new PresentationEventBus();
    const playSfx = vi.fn();
    const consumer = new AudioPresentationConsumer({ playSfx }, bus);

    bus.publish({ type: 'meld_declared', playerId: 1, meldType: 'chi' });
    bus.publish({ type: 'meld_declared', playerId: 2, meldType: 'pon' });
    bus.publish({ type: 'meld_declared', playerId: 3, meldType: 'kan' });

    expect(playSfx).not.toHaveBeenCalled();
    consumer.dispose();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { PresentationEventBus } from '../presentation/PresentationEventBus';
import { PresentationAudioCues } from '../presentation/PresentationAudioCue';
import { AudioPresentationConsumer } from './AudioPresentationConsumer';

describe('AudioPresentationConsumer', () => {
  it('confirmed TileDiscarded 保持静音，只有 impact cue 播放一次 discard SFX', () => {
    const bus = new PresentationEventBus();
    const cues = new PresentationAudioCues();
    const playSfx = vi.fn();
    const consumer = new AudioPresentationConsumer({ playSfx }, cues);
    const event = bus.publish({
      type: 'tile_discarded',
      playerId: 0,
      tile: { id: 0, red: false },
      riverIndex: 0,
      isRiichiDiscard: false,
    });
    expect(playSfx).not.toHaveBeenCalled();
    cues.run(event).emit('discard-impact', 'river-settle', 0);
    expect(playSfx).toHaveBeenCalledOnce();
    expect(playSfx).toHaveBeenCalledWith('discard');
    consumer.dispose();
  });

  it('Test Mode / Replay policy 关闭时不播放，重新允许后只处理新事件', () => {
    let enabled = false;
    const bus = new PresentationEventBus();
    const cues = new PresentationAudioCues();
    const playSfx = vi.fn();
    const consumer = new AudioPresentationConsumer({ playSfx }, cues, () => enabled);
    const input = {
      type: 'tile_discarded' as const,
      playerId: 0 as const,
      tile: { id: 1 as const, red: false },
      riverIndex: 0,
      isRiichiDiscard: false,
    };
    const muted = bus.publish(input);
    cues.run(muted).emit('discard-impact', 'river-settle', 0);
    enabled = true;
    cues.run(muted).emit('discard-impact', 'river-settle', 0);
    cues.run(bus.publish({ ...input, riverIndex: 1 })).emit('discard-impact', 'river-settle', 0);
    expect(playSfx).toHaveBeenCalledTimes(1);
    consumer.dispose();
    cues.run(bus.publish({ ...input, riverIndex: 2 })).emit('discard-impact', 'river-settle', 0);
    expect(playSfx).toHaveBeenCalledTimes(1);
  });

  it('riichi_declared 不播放假音效，也不重复 discard SFX', () => {
    const bus = new PresentationEventBus();
    const cues = new PresentationAudioCues();
    const playSfx = vi.fn();
    const consumer = new AudioPresentationConsumer({ playSfx }, cues);

    bus.publish({ type: 'riichi_declared', playerId: 0, riverIndex: 2 });

    expect(playSfx).not.toHaveBeenCalled();
    consumer.dispose();
  });

  it('meld_declared chi / pon / kan 各播放一次 meld 组音效', () => {
    const bus = new PresentationEventBus();
    const cues = new PresentationAudioCues();
    const playSfx = vi.fn();
    const consumer = new AudioPresentationConsumer({ playSfx }, cues);

    const chi = bus.publish({ type: 'meld_declared', playerId: 1, meldType: 'chi' });
    cues.run(chi).emit('meld-impact', 'release', 1);
    const pon = bus.publish({ type: 'meld_declared', playerId: 2, meldType: 'pon' });
    cues.run(pon).emit('meld-impact', 'release', 1);
    const kan = bus.publish({ type: 'meld_declared', playerId: 3, meldType: 'kan' });
    cues.run(kan).emit('meld-impact', 'release', 1);

    expect(playSfx).toHaveBeenCalledTimes(3);
    expect(playSfx.mock.calls.map(([id]) => id)).toEqual(['chi', 'pon', 'kan']);
    consumer.dispose();
  });

  it('tile_drawn 播放一次 draw SFX', () => {
    const bus = new PresentationEventBus();
    const cues = new PresentationAudioCues();
    const playSfx = vi.fn();
    const consumer = new AudioPresentationConsumer({ playSfx }, cues);
    const draw = bus.publish({ type: 'tile_drawn', playerId: 0 });
    expect(playSfx).not.toHaveBeenCalled();
    cues.run(draw).emit('draw-contact', 'grasp', 0);
    expect(playSfx).toHaveBeenCalledOnce();
    expect(playSfx).toHaveBeenCalledWith('draw');
    consumer.dispose();
  });
});

it('six semantic cues map to six libraries; no immediate event or duplicate playback', () => {
  const cues = new PresentationAudioCues(); const bus = new PresentationEventBus();
  const playSfx = vi.fn(); const consumer = new AudioPresentationConsumer({playSfx}, cues);
  const riichi = bus.publish({type:'riichi_declared',playerId:0,riverIndex:0});
  const dora = bus.publish({type:'dora_revealed',instanceId:'new-dora'});
  const ron = bus.publish({type:'win_declared',playerId:0,winType:'ron'});
  const tsumo = bus.publish({type:'win_declared',playerId:0,winType:'tsumo'});
  expect(playSfx).not.toHaveBeenCalled();
  for (let repeat=0; repeat<2; repeat++) {
    cues.run(riichi).emit('riichi-stick-impact','release',1);
    cues.run(dora).emit('dora-reveal','visual-commit',1);
    cues.run(ron).emit('win-impact','push',0);
    cues.run(tsumo).emit('win-impact','push',0);
  }
  expect(playSfx.mock.calls.map(([id])=>id)).toEqual(['riichi','dora','rong','rong']);
  consumer.dispose();
});

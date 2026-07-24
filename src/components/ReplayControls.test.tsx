import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReplayControls } from './ReplayControls';

describe('ReplayControls', () => {
  it('renders playback buttons, speed options, and progress', () => {
    const html = renderToStaticMarkup(
      <ReplayControls
        controller={{ status: 'paused', currentEventIndex: 2, speed: 1 }}
        eventCount={10}
        onPlay={() => undefined}
        onPause={() => undefined}
        onStepForward={() => undefined}
        onStepBackward={() => undefined}
        onSeekStart={() => undefined}
        onSeekEnd={() => undefined}
        onSpeedChange={() => undefined}
      />,
    );
    expect(html).toContain('播放');
    expect(html).toContain('上一步');
    expect(html).toContain('4倍');
    expect(html).toContain('3 / 10');
  });
});

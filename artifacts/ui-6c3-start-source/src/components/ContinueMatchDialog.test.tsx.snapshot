import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sampleSavedMatch } from '../game/persistence/saveTestUtils';
import { ContinueMatchDialog } from './ContinueMatchDialog';

describe('ContinueMatchDialog', () => {
  it('renders continue and discard choices for a valid save', () => {
    const html = renderToStaticMarkup(<ContinueMatchDialog save={sampleSavedMatch()} onContinue={() => undefined} onDiscard={() => undefined} />);
    expect(html).toContain('继续对局');
    expect(html).toContain('继续比赛');
    expect(html).toContain('放弃存档');
  });

  it('renders load errors without requiring a save', () => {
    const html = renderToStaticMarkup(<ContinueMatchDialog save={null} error="存档损坏" onContinue={() => undefined} onDiscard={() => undefined} />);
    expect(html).toContain('存档损坏');
  });
});

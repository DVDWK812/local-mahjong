import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/engine';
import { Table3DCentralHud, Table3DHud } from './Table3DHud';

describe('Table3DHud', () => {
  it('renders player HUD plus shared screen-space Dora without duplicating the center state', () => {
    const html = renderToStaticMarkup(<Table3DHud gameState={createInitialGameState()} />);

    expect(html).toContain('class="table-3d-hud"');
    expect(html).not.toContain('中央计分区');
    expect((html.match(/data-player-zone=/g) ?? [])).toHaveLength(4);
    expect(html).toContain('data-player-slot="bottom"');
    expect((html.match(/--avatar-frame-offset-x:/g) ?? [])).toHaveLength(4);
    expect((html.match(/--avatar-frame-offset-y:/g) ?? [])).toHaveLength(4);
    expect((html.match(/--avatar-frame-size:1\.1/g) ?? [])).toHaveLength(4);
    expect((html.match(/--avatar-frame-offset-x:500px/g) ?? [])).toHaveLength(1);
    expect((html.match(/--avatar-frame-offset-x:-30px/g) ?? [])).toHaveLength(1);
    expect((html.match(/--avatar-frame-offset-x:350px/g) ?? [])).toHaveLength(1);
    expect((html.match(/--avatar-frame-offset-x:30px/g) ?? [])).toHaveLength(1);
    expect((html.match(/--avatar-frame-offset-y:-100px/g) ?? [])).toHaveLength(1);
    expect((html.match(/--avatar-frame-offset-y:0px/g) ?? [])).toHaveLength(3);
    expect(html).not.toContain('class="mahjong-table"');
    expect(html).not.toContain('discard-river');
    expect(html).not.toContain('hand-track');
    expect(html).toContain('table-3d-dora-layer');
    expect(html).toContain('dora-indicator-stack');
    expect((html.match(/data-dora-state=/g) ?? [])).toHaveLength(5);
    expect((html.match(/data-dora-state="revealed"/g) ?? [])).toHaveLength(1);
    expect((html.match(/data-dora-state="hidden"/g) ?? [])).toHaveLength(4);
  });

  it('renders the existing authoritative center HUD for the 3D console anchor', () => {
    const html = renderToStaticMarkup(<Table3DCentralHud gameState={createInitialGameState()} />);

    expect(html).toContain('data-hud-anchor="central-console-3d"');
    expect(html).toContain('aria-label="中央计分区"');
    expect((html.match(/data-center-player=/g) ?? [])).toHaveLength(4);
    expect(html).not.toContain('dora-indicator-stack');
  });
});

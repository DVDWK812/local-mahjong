import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOP_SIDE_FILL_LIGHT } from './TableLighting';

function sourcePath(relativePath: string): string {
  return decodeURIComponent(new URL(relativePath, import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
}

describe('UI-5F top-side fill light', () => {
  it('keeps the top fill manual-tuning values under one authority', () => {
    expect(TOP_SIDE_FILL_LIGHT).toEqual({
      position: [0, 8, -11.5],
      intensity: 30,
      color: '#edf5ef',
      distance: 15,
      decay: 2,
    });
  });

  it('uses a static shadowless point light without a render loop', () => {
    const source = readFileSync(sourcePath('./TableLighting.tsx'), 'utf8');
    const fillLightSource = source.slice(source.indexOf('<pointLight'), source.indexOf('/>', source.indexOf('<pointLight')));

    expect(fillLightSource).toContain('position={TOP_SIDE_FILL_LIGHT.position}');
    expect(fillLightSource).toContain('intensity={TOP_SIDE_FILL_LIGHT.intensity}');
    expect(fillLightSource).toContain('color={TOP_SIDE_FILL_LIGHT.color}');
    expect(fillLightSource).not.toContain('castShadow');
    expect(source).not.toContain('useFrame');
  });
});

import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { getFeltMaterialAppearance } from './TableMesh';
import { DEFAULT_TABLE_VISUAL_THEME } from './tableVisualTheme';

describe('TableMesh felt appearance', () => {
  it('keeps classic green only for the builtin felt and uses a neutral base for custom artwork', () => {
    const builtin = getFeltMaterialAppearance(DEFAULT_TABLE_VISUAL_THEME);
    const customTexture = new Texture();
    const custom = getFeltMaterialAppearance(DEFAULT_TABLE_VISUAL_THEME, customTexture);

    expect(builtin.color).toBe(DEFAULT_TABLE_VISUAL_THEME.felt.color);
    expect(builtin.map).toBeNull();
    expect(custom.color).toBe('#ffffff');
    expect(custom.map).toBe(customTexture);

    const replacement = new Texture();
    expect(getFeltMaterialAppearance(DEFAULT_TABLE_VISUAL_THEME, replacement).map).toBe(replacement);
    const reset = getFeltMaterialAppearance(DEFAULT_TABLE_VISUAL_THEME, undefined);
    expect(reset.map).toBeNull();
    expect(reset.color).toBe(builtin.color);
  });
});

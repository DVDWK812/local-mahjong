export type FeltDecorationPreset = 'classic-lines' | 'none';

export type TableVisualTheme = Readonly<{
  id: string;
  felt: Readonly<{
    color: string;
    roughness: number;
    metalness: number;
  }>;
  edge: Readonly<{
    color: string;
    roughness: number;
    metalness: number;
  }>;
  edgeAccent: Readonly<{
    color: string;
    roughness: number;
  }>;
  decoration: Readonly<{
    preset: FeltDecorationPreset;
    frameColor: string;
    frameOpacity: number;
    guideColor: string;
    guideOpacity: number;
  }>;
}>;

/** Renderer-only default. It intentionally contains no coordinates or gameplay state. */
export const DEFAULT_TABLE_VISUAL_THEME: TableVisualTheme = {
  id: 'classic-green',
  felt: {
    color: '#175f49',
    roughness: 0.88,
    metalness: 0.01,
  },
  edge: {
    color: '#281d19',
    roughness: 0.48,
    metalness: 0.08,
  },
  edgeAccent: {
    color: '#d6c48a',
    roughness: 0.5,
  },
  decoration: {
    preset: 'classic-lines',
    frameColor: '#decf9b',
    frameOpacity: 0.42,
    guideColor: '#9fc6b1',
    guideOpacity: 0.24,
  },
};

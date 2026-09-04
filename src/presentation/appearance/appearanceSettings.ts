import type { TileAssetKey } from '../../game/tileAssets';

/** A persisted reference only. Binary image payloads live in AppearanceAssetStorage. */
export type AppearanceAssetRef = Readonly<
  | { kind: 'builtin'; id: string }
  | { kind: 'local'; assetId: string }
>;

/** Reuses gameplay tile keys and adds the three existing Aka visual identities. */
export type TileAppearanceId = TileAssetKey | 'red5m' | 'red5p' | 'red5s';

export const TILE_APPEARANCE_IDS: readonly TileAppearanceId[] = [
  'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9',
  'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9',
  's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9',
  'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7',
  'red5m', 'red5p', 'red5s',
];

export type TileFaceAppearance = Readonly<{
  /** Global per-tile glyph/image. Builtin resolves to the transparent 3D glyph. */
  face: AppearanceAssetRef;
  /** Front 75% body color; independent of the owner's rear 25% color. */
  sideColor: string;
}>;

export type TileBackAppearance = Readonly<{
  /** Future back-surface resource; current Tile3D back texture remains authoritative. */
  texture: AppearanceAssetRef;
  /** Future back body/side color. */
  sideColor: string;
}>;

export type AppearanceSettings = Readonly<{
  version: typeof APPEARANCE_SETTINGS_VERSION;
  /** Distinguishes pre-renderer placeholder colors from explicit user colors. */
  tileFaceColorsReady?: true;
  tileFaces: Readonly<Record<TileAppearanceId, TileFaceAppearance>>;
  tileBack: TileBackAppearance;
  tableFelt: Readonly<{ asset: AppearanceAssetRef }>;
  riichiStick: Readonly<{ asset: AppearanceAssetRef }>;
  /** Reserved until hand visuals have a product contract. */
  handAppearance: Readonly<{ status: 'reserved' }>;
}>;

export const APPEARANCE_SETTINGS_VERSION = 2;
const DEFAULT_TILE_SIDE_COLOR = '#f2e6c9';
/** Matches the frozen Tile3D back-body baseline when no customization exists. */
const DEFAULT_BACK_SIDE_COLOR = '#17483f';
const PRE_RENDERER_BACK_SIDE_COLOR = '#8c3040';
const DEFAULT_FACE_ASSET: AppearanceAssetRef = Object.freeze({ kind: 'builtin', id: 'default' });

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = Object.freeze({
  version: APPEARANCE_SETTINGS_VERSION,
  tileFaceColorsReady: true,
  tileFaces: Object.freeze(createDefaultTileFaces()),
  tileBack: Object.freeze({ texture: Object.freeze({ kind: 'builtin', id: 'default' }), sideColor: DEFAULT_BACK_SIDE_COLOR }),
  tableFelt: Object.freeze({ asset: Object.freeze({ kind: 'builtin', id: 'classic-green' }) }),
  riichiStick: Object.freeze({ asset: Object.freeze({ kind: 'builtin', id: 'default' }) }),
  handAppearance: Object.freeze({ status: 'reserved' }),
});

type AppearanceSettingsDraft = Readonly<Record<string, unknown>>;

/** Accepts v2 and migrates the persisted v1 / versionless 2A shapes. */
export function migrateAppearanceSettings(value: unknown): AppearanceSettings | null {
  if (!isRecord(value)) return null;
  if (value.version === APPEARANCE_SETTINGS_VERSION) return normalizeV2Draft(value);
  if (value.version === 1 || value.version === undefined) return migrateV1Draft(value);
  return null;
}

export function normalizeAppearanceSettings(value: unknown): AppearanceSettings {
  return migrateAppearanceSettings(value) ?? createDefaultAppearanceSettings();
}

export function createDefaultAppearanceSettings(): AppearanceSettings {
  return {
    version: APPEARANCE_SETTINGS_VERSION,
    tileFaceColorsReady: true,
    tileFaces: createDefaultTileFaces(),
    tileBack: { texture: { kind: 'builtin', id: 'default' }, sideColor: DEFAULT_BACK_SIDE_COLOR },
    tableFelt: { asset: { kind: 'builtin', id: 'classic-green' } },
    riichiStick: { asset: { kind: 'builtin', id: 'default' } },
    handAppearance: { status: 'reserved' },
  };
}

function createDefaultTileFaces(face: AppearanceAssetRef = DEFAULT_FACE_ASSET): Record<TileAppearanceId, TileFaceAppearance> {
  return Object.fromEntries(TILE_APPEARANCE_IDS.map((id) => [
    id,
    { face: { ...face }, sideColor: DEFAULT_TILE_SIDE_COLOR },
  ])) as Record<TileAppearanceId, TileFaceAppearance>;
}

function migrateV1Draft(draft: AppearanceSettingsDraft): AppearanceSettings {
  const legacyFaceSet = normalizeAssetRef(draft.tileFaceSet) ?? DEFAULT_FACE_ASSET;
  const legacyBack = normalizeAssetRef(draft.tileBack) ?? { kind: 'builtin' as const, id: 'default' };
  const legacyFelt = normalizeAssetRef(draft.tableFelt) ?? { kind: 'builtin' as const, id: 'classic-green' };
  const legacyStick = normalizeAssetRef(draft.riichiStick) ?? { kind: 'builtin' as const, id: 'default' };
  return {
    version: APPEARANCE_SETTINGS_VERSION,
    tileFaceColorsReady: true,
    tileFaces: createDefaultTileFaces(legacyFaceSet),
    tileBack: { texture: legacyBack, sideColor: DEFAULT_BACK_SIDE_COLOR },
    tableFelt: { asset: legacyFelt },
    riichiStick: { asset: legacyStick },
    handAppearance: { status: 'reserved' },
  };
}

function normalizeV2Draft(draft: AppearanceSettingsDraft): AppearanceSettings {
  const defaults = createDefaultAppearanceSettings();
  const rawBack = isRecord(draft.tileBack) ? draft.tileBack : {};
  const rawFelt = isRecord(draft.tableFelt) ? draft.tableFelt : {};
  const rawStick = isRecord(draft.riichiStick) ? draft.riichiStick : {};
  return {
    version: APPEARANCE_SETTINGS_VERSION,
    tileFaceColorsReady: true,
    tileFaces: normalizeTileFaces(draft.tileFaces, defaults.tileFaces, draft.tileFaceColorsReady === true),
    tileBack: {
      texture: normalizeAssetRef(rawBack.texture) ?? defaults.tileBack.texture,
      sideColor: normalizeBackSideColor(rawBack.sideColor) ?? defaults.tileBack.sideColor,
    },
    tableFelt: { asset: normalizeAssetRef(rawFelt.asset) ?? defaults.tableFelt.asset },
    riichiStick: { asset: normalizeAssetRef(rawStick.asset) ?? defaults.riichiStick.asset },
    handAppearance: { status: 'reserved' },
  };
}

/** v2 existed before side color was rendered, so its placeholder default is safely migrated. */
function normalizeBackSideColor(value: unknown): string | null {
  const color = normalizeAppearanceColor(value);
  return color === PRE_RENDERER_BACK_SIDE_COLOR ? DEFAULT_BACK_SIDE_COLOR : color;
}

function normalizeTileFaces(value: unknown, defaults: Readonly<Record<TileAppearanceId, TileFaceAppearance>>, colorsReady: boolean): Record<TileAppearanceId, TileFaceAppearance> {
  const draft = isRecord(value) ? value : {};
  return Object.fromEntries(TILE_APPEARANCE_IDS.map((id) => {
    const candidate = isRecord(draft[id]) ? draft[id] : {};
    return [id, {
      face: normalizeAssetRef(candidate.face) ?? defaults[id].face,
      sideColor: !colorsReady && candidate.sideColor === '#ece5d4' ? DEFAULT_TILE_SIDE_COLOR : normalizeAppearanceColor(candidate.sideColor) ?? defaults[id].sideColor,
    }];
  })) as Record<TileAppearanceId, TileFaceAppearance>;
}

/** Hex colors keep the future material boundary serializable and renderer-neutral. */
export function normalizeAppearanceColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

export function normalizeAssetRef(value: unknown): AppearanceAssetRef | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'builtin' && isStableIdentifier(value.id)) return { kind: 'builtin', id: value.id };
  if (value.kind === 'local' && isStableIdentifier(value.assetId)) return { kind: 'local', assetId: value.assetId };
  return null;
}

function isStableIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,127}$/i.test(value);
}

function isRecord(value: unknown): value is AppearanceSettingsDraft {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export const TABLE_SURFACE_SPEC = {
  feltCenterY: 0.5,
  feltThickness: 0.54,
  flatEpsilon: 0.55,
  standingEpsilon: 0.6,
} as const;

export const TABLE_FELT_TOP_Y = TABLE_SURFACE_SPEC.feltCenterY
  + TABLE_SURFACE_SPEC.feltThickness / 2;

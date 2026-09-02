export type RiichiStick3DAppearance = Readonly<{
  textureSource: string;
  bodyColor: string;
  bodyRoughness: number;
  bodyMetalness: number;
}>;

/** Theme/customization authority for every authoritative stick and animation proxy. */
export const DEFAULT_RIICHI_STICK_3D_APPEARANCE: RiichiStick3DAppearance = {
  textureSource: '/assets/riichi-stick-default.svg',
  bodyColor: '#fff8e8',
  bodyRoughness: 0.48,
  bodyMetalness: 0,
};

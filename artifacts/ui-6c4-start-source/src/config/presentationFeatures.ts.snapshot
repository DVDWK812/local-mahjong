export interface PresentationFeatureFlags {
  readonly presentationEvents: boolean;
  readonly handAnimations: boolean;
}

export const defaultPresentationFeatures: Readonly<PresentationFeatureFlags> = Object.freeze({
  presentationEvents: true,
  handAnimations: true,
});

export type PresentationFeatureFlagsSource = () => Readonly<PresentationFeatureFlags>;

export const getPresentationFeatures: PresentationFeatureFlagsSource = () => defaultPresentationFeatures;

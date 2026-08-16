export interface PresentationFeatureFlags {
  readonly presentationEvents: boolean;
}

export const defaultPresentationFeatures: Readonly<PresentationFeatureFlags> = Object.freeze({
  presentationEvents: true,
});

export type PresentationFeatureFlagsSource = () => Readonly<PresentationFeatureFlags>;

export const getPresentationFeatures: PresentationFeatureFlagsSource = () => defaultPresentationFeatures;

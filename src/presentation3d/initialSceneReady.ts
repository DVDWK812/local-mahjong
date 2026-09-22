export type InitialSceneReadiness = Readonly<{
  rendererReady: boolean;
  tableSceneReady: boolean;
  criticalAssetsReady: boolean;
  localPresentationReady: boolean;
}>;

export function isInitialSceneReady(readiness: InitialSceneReadiness): boolean {
  return readiness.rendererReady
    && readiness.tableSceneReady
    && readiness.criticalAssetsReady
    && readiness.localPresentationReady;
}

export function isInitialPresentationReady(
  sceneReady: boolean,
  localPresentationReady: boolean,
): boolean {
  return sceneReady && localPresentationReady;
}

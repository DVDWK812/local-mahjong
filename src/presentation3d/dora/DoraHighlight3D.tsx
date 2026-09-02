import { useEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  Color,
  FrontSide,
  ShaderMaterial,
  Vector3,
} from 'three';
import { TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import {
  MAHJONG_TILE_DIMENSIONS,
  sharedTileBodyGeometry,
} from '../tile/tileGeometry';
import {
  useDoraSweep3DRegistration,
  type DoraSweep3DRegistration,
} from './DoraSweep3DProvider';
import type { DoraSweep3DVariant } from './DoraSweep3DController';

export function DoraHighlight3D({
  sweepKey,
  variant,
  dimmed,
}: Readonly<{
  sweepKey?: string;
  variant: DoraSweep3DVariant;
  dimmed: boolean;
}>) {
  const material = useMemo(createDoraSweep3DMaterial, []);
  const registration = useMemo<DoraSweep3DRegistration>(() => ({
    target: { key: sweepKey ?? '', variant },
    setSweep: (snapshot) => {
      material.uniforms.uProgress.value = snapshot?.progress ?? 0;
      material.uniforms.uActive.value = snapshot ? 1 : 0;
    },
  }), [material, sweepKey, variant]);

  useDoraSweep3DRegistration(sweepKey, registration);

  useEffect(() => {
    material.uniforms.uDimmed.value = dimmed ? 1 : 0;
    material.needsUpdate = true;
  }, [dimmed, material]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh
      name="dora-highlight-3d"
      geometry={sharedTileBodyGeometry}
      material={material}
      scale={TABLE_PRESENTATION_TUNING.doraSweep3D.shellScale}
      renderOrder={5}
      raycast={() => undefined}
    />
  );
}

export function createDoraSweep3DMaterial(): ShaderMaterial {
  const tuning = TABLE_PRESENTATION_TUNING.doraSweep3D;
  const direction = new Vector3(...tuning.direction).normalize();
  const material = new ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
    fog: false,
    toneMapped: false,
    uniforms: {
      uProgress: { value: 0 },
      uActive: { value: 0 },
      uDimmed: { value: 0 },
      uDirection: { value: direction },
      uHalfExtents: { value: new Vector3(
        MAHJONG_TILE_DIMENSIONS.width / 2,
        MAHJONG_TILE_DIMENSIONS.height / 2,
        MAHJONG_TILE_DIMENSIONS.depth / 2,
      ) },
      uBandWidth: { value: tuning.bandWidth },
      uSoftness: { value: tuning.softness },
      uIntensity: { value: tuning.intensity },
      uDimmedStrength: { value: tuning.dimmedStrength },
      uColor: { value: new Color(tuning.color) },
      uStart: { value: tuning.start },
      uEnd: { value: tuning.end },
    },
    vertexShader: `
      varying vec3 vTileLocalPosition;

      void main() {
        vTileLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uProgress;
      uniform float uActive;
      uniform float uDimmed;
      uniform vec3 uDirection;
      uniform vec3 uHalfExtents;
      uniform float uBandWidth;
      uniform float uSoftness;
      uniform float uIntensity;
      uniform float uDimmedStrength;
      uniform vec3 uColor;
      uniform float uStart;
      uniform float uEnd;
      varying vec3 vTileLocalPosition;

      void main() {
        float projectedExtent = max(dot(abs(uDirection), uHalfExtents), 0.0001);
        float sweepCoord = dot(vTileLocalPosition, uDirection) / projectedExtent;
        float bandCenter = mix(uStart, uEnd, uProgress);
        float distanceToBand = abs(sweepCoord - bandCenter);
        float band = 1.0 - smoothstep(uBandWidth, uBandWidth + uSoftness, distanceToBand);
        float fadeIn = smoothstep(0.0, 0.12, uProgress);
        float fadeOut = 1.0 - smoothstep(0.84, 1.0, uProgress);
        float dimStrength = mix(1.0, uDimmedStrength, uDimmed);
        float alpha = band * fadeIn * fadeOut * uIntensity * dimStrength * uActive;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  material.name = 'dora-highlight-3d-local-space-sweep';
  return material;
}

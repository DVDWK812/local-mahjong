import { BufferAttribute, type BufferGeometry } from 'three';

/**
 * Drei RoundedBox is an extrusion: its default UVs are extrusion coordinates,
 * not normalized tabletop coordinates. With ClampToEdge they sample almost
 * exclusively one border texel. Project only the UV attribute onto local XZ;
 * leave positions, normals, indices, bounds and the rounded silhouette intact.
 * Far (-Z) is the top of the image (v=1 for an ordinary flipY image texture).
 */
export function applyFeltSurfaceUvs(
  geometry: BufferGeometry,
  dimensions: Readonly<{ width: number; depth: number }>,
): void {
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv')
    ?? new BufferAttribute(new Float32Array(position.count * 2), 2);
  for (let index = 0; index < position.count; index += 1) {
    uv.setXY(
      index,
      0.5 + position.getX(index) / dimensions.width,
      0.5 - position.getZ(index) / dimensions.depth,
    );
  }
  geometry.setAttribute('uv', uv);
  uv.needsUpdate = true;
}

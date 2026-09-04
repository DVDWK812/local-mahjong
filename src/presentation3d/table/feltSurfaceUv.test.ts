import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape } from 'three';
import { describe, expect, it } from 'vitest';
import { applyFeltSurfaceUvs } from './feltSurfaceUv';
import { TABLE_FELT_DIMENSIONS } from './TableMesh';
import { DEFAULT_FELT_MAIN_VIEW_MAPPING } from './feltMainViewMapping';

describe('felt surface UV sampling', () => {
  it('replaces extrusion-unit UVs without changing any physical geometry', () => {
    const { width, depth } = TABLE_FELT_DIMENSIONS;
    // Same UV-producing geometry class as Drei RoundedBox. Default extrusion
    // coordinates exceed [0,1] and ClampToEdge collapses most of the image.
    const shape = new Shape().moveTo(0, 0).lineTo(width, 0)
      .lineTo(width, 0.54).lineTo(0, 0.54).closePath();
    const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false }).center();
    const uv = geometry.getAttribute('uv');
    expect(Math.max(...uv.array)).toBeGreaterThan(30);
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const before = Array.from(positions.array);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!.clone();

    applyFeltSurfaceUvs(geometry, TABLE_FELT_DIMENSIONS);
    expect(geometry.getAttribute('uv')).toBe(uv);
    expect(geometry.getAttribute('position')).toBe(positions);
    expect(geometry.getAttribute('normal')).toBe(normals);
    expect(Array.from(positions.array)).toEqual(before);
    expect(geometry.boundingBox).toEqual(bounds);
    const u = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    const v = Array.from({ length: uv.count }, (_, i) => uv.getY(i));
    expect(Math.min(...u)).toBeCloseTo(0);
    expect(Math.max(...u)).toBeCloseTo(1);
    expect(Math.min(...v)).toBeCloseTo(0);
    expect(Math.max(...v)).toBeCloseTo(1);
    // A horizontal triangle must cover an area in UV space, not a line/texel.
    let topArea = 0;
    for (let i = 0; i < positions.count; i += 3) {
      if (normals.getY(i) < 0.99) continue;
      topArea += Math.abs((u[i + 1] - u[i]) * (v[i + 2] - v[i])
        - (u[i + 2] - u[i]) * (v[i + 1] - v[i])) / 2;
    }
    expect(topArea).toBeCloseTo(1);
    const fixed = Array.from(uv.array);
    applyFeltSurfaceUvs(geometry, TABLE_FELT_DIMENSIONS);
    expect(geometry.getAttribute('uv')).toBe(uv);
    expect(Array.from(uv.array)).toEqual(fixed);
    geometry.dispose();
  });

  it('gives near/far points the same UV convention as the main-view transform', () => {
    const { width, depth } = TABLE_FELT_DIMENSIONS;
    const { visibleUvRect: rect, textureRepeat, textureOffset } = DEFAULT_FELT_MAIN_VIEW_MAPPING;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([
      -width / 2, 0, depth * (0.5 - rect.v),
      width / 2, 0, depth * (0.5 - rect.v - rect.height),
    ], 3));
    applyFeltSurfaceUvs(geometry, TABLE_FELT_DIMENSIONS);
    const uv = geometry.getAttribute('uv');
    expect(uv.getX(0)).toBe(0);
    expect(uv.getX(1)).toBe(1);
    expect(uv.getY(0) * textureRepeat[1] + textureOffset[1]).toBeCloseTo(0);
    expect(uv.getY(1) * textureRepeat[1] + textureOffset[1]).toBeCloseTo(1);
    geometry.dispose();
  });
});

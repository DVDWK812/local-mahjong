import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { TABLE_CAMERA } from './FixedTableCamera';
import { TABLE_WORLD_DIMENSIONS } from '../table/TableMesh';

describe('UI-5C.1 complete-table camera framing', () => {
  it('keeps the frozen elevated camera and moderate field of view', () => {
    expect(TABLE_CAMERA.position).toEqual([0, 35, 27]);
    expect(TABLE_CAMERA.target).toEqual([0, 0.72, 4]);
    expect(TABLE_CAMERA.fov).toBe(32);
    expect(TABLE_CAMERA.near).toBe(0.1);
    expect(TABLE_CAMERA.far).toBe(60);
    const elevation = Math.atan2(
      TABLE_CAMERA.position[1] - TABLE_CAMERA.target[1],
      TABLE_CAMERA.position[2] - TABLE_CAMERA.target[2],
    );
    expect(elevation).toBeCloseTo(0.979837537287412, 12);
  });

  it.each([
    ['1280×720', 1280 / 676, 1.0309937709138486],
    ['1920×1080', 1920 / 1036, 1.053362472057936],
  ])('matches the frozen tabletop projection baseline at %s', (_label, aspect, expectedMaxAbsX) => {
    const camera = new PerspectiveCamera(
      TABLE_CAMERA.fov,
      aspect as number,
      TABLE_CAMERA.near,
      TABLE_CAMERA.far,
    );
    camera.position.set(...TABLE_CAMERA.position);
    camera.lookAt(...TABLE_CAMERA.target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const halfWidth = TABLE_WORLD_DIMENSIONS.width / 2;
    const halfDepth = TABLE_WORLD_DIMENSIONS.depth / 2;
    const projectedCorners = [
      [-halfWidth, 0.5, -halfDepth],
      [halfWidth, 0.5, -halfDepth],
      [-halfWidth, 0.5, halfDepth],
      [halfWidth, 0.5, halfDepth],
    ].map((point) => new Vector3(point[0], point[1], point[2]).project(camera));
    const projectedHandCenters = [
      new Vector3(0, 1.24, -10.2).project(camera),
      new Vector3(0, 1.24, 10.2).project(camera),
    ];

    expect(Math.max(...projectedCorners.map(({ x }) => Math.abs(x))))
      .toBeCloseTo(expectedMaxAbsX, 12);
    expect(Math.min(...projectedCorners.map(({ y }) => y))).toBeCloseTo(-1.1644294537429911, 12);
    expect(Math.max(...projectedCorners.map(({ y }) => y))).toBeCloseTo(1.157054735972818, 12);
    expect(Math.min(...projectedHandCenters.map(({ y }) => y))).toBeCloseTo(-0.45312878280434626, 12);
    expect(Math.max(...projectedHandCenters.map(({ y }) => y))).toBeCloseTo(0.864079363820786, 12);
  });
});

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

export type Point3 = readonly [number, number, number];
export type WorldTuning = Readonly<{
  position: Readonly<{ x: number; y: number; z: number }>;
  rotation: Readonly<{ x: number; y: number; z: number }>;
  scale: number;
}>;
export type DomTuning = Readonly<{ x: number; y: number; scale: number }>;
export type RegionTuning = Readonly<{ offset: WorldTuning; pivot: Point3 }>;
export type SeatRegionTuning = Readonly<Partial<Record<'hand' | 'river' | 'melds' | 'nuki', RegionTuning>>>;

/** Generic renderer boundary: no mode, rules or sanma constant imports. */
export function regionMatrix(region?: RegionTuning): Matrix4 {
  if (!region) return new Matrix4();
  const { position: p, rotation: r, scale } = region.offset;
  const pivot = region.pivot;
  return new Matrix4().compose(
    new Vector3(pivot[0] + p.x, pivot[1] + p.y, pivot[2] + p.z),
    new Quaternion().setFromEuler(new Euler(r.x, r.y, r.z)),
    new Vector3(scale, scale, scale),
  ).multiply(new Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
}

export function tunePoint(point: Point3, region?: RegionTuning): Point3 {
  return region ? new Vector3(...point).applyMatrix4(regionMatrix(region)).toArray() : point;
}

/** Interpolate the same regional adjustment used by static meshes, after baseline animation. */
export function motionRegion(source: RegionTuning | undefined, destination: RegionTuning | undefined, progress: number) {
  const a = regionMatrix(source), b = regionMatrix(destination);
  const ap = new Vector3(), bp = new Vector3(), aq = new Quaternion(), bq = new Quaternion(), as = new Vector3(), bs = new Vector3();
  a.decompose(ap, aq, as); b.decompose(bp, bq, bs);
  return { matrix: new Matrix4().compose(ap.lerp(bp, progress), aq.slerp(bq, progress), as.lerp(bs, progress)),
    rotation: aq, scale: as.x };
}

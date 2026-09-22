import m1 from '../assets/tiles/faces-transparent/m1.png';
import m2 from '../assets/tiles/faces-transparent/m2.png';
import m3 from '../assets/tiles/faces-transparent/m3.png';
import m4 from '../assets/tiles/faces-transparent/m4.png';
import m5 from '../assets/tiles/faces-transparent/m5.png';
import m6 from '../assets/tiles/faces-transparent/m6.png';
import m7 from '../assets/tiles/faces-transparent/m7.png';
import m8 from '../assets/tiles/faces-transparent/m8.png';
import m9 from '../assets/tiles/faces-transparent/m9.png';
import p1 from '../assets/tiles/faces-transparent/p1.png';
import p2 from '../assets/tiles/faces-transparent/p2.png';
import p3 from '../assets/tiles/faces-transparent/p3.png';
import p4 from '../assets/tiles/faces-transparent/p4.png';
import p5 from '../assets/tiles/faces-transparent/p5.png';
import p6 from '../assets/tiles/faces-transparent/p6.png';
import p7 from '../assets/tiles/faces-transparent/p7.png';
import p8 from '../assets/tiles/faces-transparent/p8.png';
import p9 from '../assets/tiles/faces-transparent/p9.png';
import placeholder from '../assets/tiles/faces-transparent/placeholder.png';
import s1 from '../assets/tiles/faces-transparent/s1.png';
import s2 from '../assets/tiles/faces-transparent/s2.png';
import s3 from '../assets/tiles/faces-transparent/s3.png';
import s4 from '../assets/tiles/faces-transparent/s4.png';
import s5 from '../assets/tiles/faces-transparent/s5.png';
import s6 from '../assets/tiles/faces-transparent/s6.png';
import s7 from '../assets/tiles/faces-transparent/s7.png';
import s8 from '../assets/tiles/faces-transparent/s8.png';
import s9 from '../assets/tiles/faces-transparent/s9.png';
import z1 from '../assets/tiles/faces-transparent/z1.png';
import z2 from '../assets/tiles/faces-transparent/z2.png';
import z3 from '../assets/tiles/faces-transparent/z3.png';
import z4 from '../assets/tiles/faces-transparent/z4.png';
import z5 from '../assets/tiles/faces-transparent/z5.png';
import z6 from '../assets/tiles/faces-transparent/z6.png';
import z7 from '../assets/tiles/faces-transparent/z7.png';
import { getTileAssetKeyById, type TileAssetKey } from '../../game/tileAssets';
import type { TileId } from '../../game/types';

const FACE_TEXTURES_3D: Record<TileAssetKey, string> = {
  m1, m2, m3, m4, m5, m6, m7, m8, m9,
  p1, p2, p3, p4, p5, p6, p7, p8, p9,
  s1, s2, s3, s4, s5, s6, s7, s8, s9,
  z1, z2, z3, z4, z5, z6, z7,
};

export function getTile3DFaceTextureById(id: TileId): string {
  return FACE_TEXTURES_3D[getTileAssetKeyById(id)] ?? placeholder;
}

export function getTile3DFaceFallbackTexture(): string {
  return placeholder;
}

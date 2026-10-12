import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { SeatSceneState } from '../sceneState/tableSceneTypes';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { canonicalToSeat } from '../coordinates/sceneTransforms';
import { getFlatTileCenterY } from '../tile/tileGrounding';
import { configureBuiltinFaceFit,configureTileTexture } from '../tile/tileTextures';
import { Tile3D } from '../tile/Tile3D';
import { GB_FLOWER_IMAGES } from '../../game/guobiao/flowerAssets';
import type { FlowerId } from '../../game/guobiao/types';
/** Dedicated public flower lane, outside the hand/river/meld regions. No Rules TileId is manufactured. */
export function flowerTileTransform(seat:Table3DSeat,index:number){
  const side=seat==='left'||seat==='right';
  const t=canonicalToSeat(seat,[(side?-7.2:seat==='top'?-5:-10)+index*0.8,getFlatTileCenterY(0.7),side?10.5:seat==='top'?5.8:7.2]);
  return side?{...t,position:[t.position[0],t.position[1],t.position[2]+2] as const}:t;
}
export function FlowerTiles3D({seatState}:{seatState:SeatSceneState}){
  const textures=useTexture(Object.values(GB_FLOWER_IMAGES));const invalidate=useThree(s=>s.invalidate),max=useThree(s=>s.gl.capabilities.getMaxAnisotropy());
  useEffect(()=>{textures.forEach(t=>{configureTileTexture(t,max);configureBuiltinFaceFit(t);});invalidate();},[textures,max,invalidate]);
  const ids=Object.keys(GB_FLOWER_IMAGES) as FlowerId[];
  return <group name={`flowers-${seatState.seat}`}>{seatState.flowers?.map((f,i)=>{const t=flowerTileTransform(seatState.seat,i);return <Tile3D
    key={f.key} ownerPlayerId={seatState.playerId} position={t.position} rotationY={t.rotationY} tileScale={0.7}
    faceTexture={textures[ids.indexOf(f.flower)]} objectName={`flower-${f.flower}`} metadata={{instanceId:f.key,flower:f.flower}} raycastDisabled />;})}</group>;
}

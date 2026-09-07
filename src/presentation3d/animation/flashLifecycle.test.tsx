import { Suspense } from 'react';
import { act, createRoot, extend, type RootState } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { Tile3D } from '../tile/Tile3D';
import { ALL_TILE_TEXTURE_SOURCES } from '../tile/tileTextures';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('local discard / ron / tsumo frames keep the same scene and visible seats without loading fresh textures', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  const pending: (() => void)[] = [];
  let imageRequests = 0;
  // Keep the real TextureLoader/useLoader cache; only control completion of image I/O.
  vi.stubGlobal('document', { createElementNS: () => {
    const image = { width: 100, height: 100, removeEventListener: vi.fn(),
      addEventListener: (type: string, listener: () => void) => { if (type === 'load') pending.push(() => listener.call(image)); },
      set src(_value: string) { imageRequests++; } };
    return image;
  } });
  const { TileTextureWarmup, TILE_TEXTURE_LOAD_INPUTS } = await import('../tile/TileTextureWarmup');
  extend({ Mesh: THREE.Mesh, Group: THREE.Group, BoxGeometry: THREE.BoxGeometry,
    PlaneGeometry: THREE.PlaneGeometry, MeshBasicMaterial: THREE.MeshBasicMaterial });
  const canvas = { addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as HTMLCanvasElement;
  const renderer = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), initTexture: vi.fn(),
    domElement: canvas, capabilities: { getMaxAnisotropy: () => 1 }, shadowMap: {}, xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() } };
  const root = createRoot(canvas);
  let state!: RootState;
  await root.configure({ gl: renderer as unknown as THREE.WebGLRenderer, frameloop: 'never', size: { width: 1280, height: 720, top: 0, left: 0 }, onCreated: s => { state = s; } });
  function Scene({ step }: { step: number }) {
    return <><mesh name="persistent-table"><boxGeometry /><meshBasicMaterial /></mesh><Suspense fallback={null}>
      <TileTextureWarmup />
      {[0, 1, 2, 3].map(seat => <group key={seat} name={`seat-${seat}`}>
        <Tile3D ownerPlayerId={seat} faceState={step < 2 ? 'face-down' : 'face-up'} tile={step < 2 ? undefined : { id: (seat + step * 4) as 0, red: false }} />
      </group>)}
      {step > 0 && <Tile3D objectName="discard" tile={{ id: 3, red: false }} />}
    </Suspense></>;
  }
  try {
    await act(async () => { root.render(<Scene step={0} />); });
    await act(async () => { pending.splice(0).forEach(resolve => resolve()); });
    await act(async () => { pending.splice(0).forEach(resolve => resolve()); });
    const scene = state.scene;
    const table = scene.getObjectByName('persistent-table');
    const seats = [0, 1, 2, 3].map(seat => scene.getObjectByName(`seat-${seat}`)!);
    expect(seats.every(Boolean)).toBe(true);
    const warmedLoadCount = imageRequests;
    for (const step of [1, 2, 3, 0]) {
      await act(async () => { root.render(<Scene step={step} />); });
      expect(state.scene).toBe(scene);
      expect(state.gl.domElement).toBe(canvas);
      expect(scene.getObjectByName('persistent-table')).toBe(table);
      seats.forEach((seat, index) => { expect(scene.getObjectByName(`seat-${index}`)).toBe(seat); expect(seat.visible).toBe(true); });
      expect(imageRequests).toBe(warmedLoadCount);
      expect(pending).toHaveLength(0);
    }
  } finally {
    await act(async () => { root.unmount(); });
    TILE_TEXTURE_LOAD_INPUTS.forEach(input => useTexture.clear(input));
    useTexture.clear([...ALL_TILE_TEXTURE_SOURCES]);
  }
});

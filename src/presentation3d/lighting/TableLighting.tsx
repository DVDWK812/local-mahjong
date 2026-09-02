export const TOP_SIDE_FILL_LIGHT = {
  position: [0, 8, -11.5] as const,
  intensity: 30,
  color: '#edf5ef',
  distance: 15,
  decay: 2,
} as const;

export function TableLighting() {
  return (
    <>
      {/* 全局环境光 */}
      <hemisphereLight
        args={['#f1f3dd', '#10251f', 1.35]}
      />

      {/* 主光 + 唯一阴影灯 */}
      <directionalLight
        color="#fff4d7"
        intensity={2.5}
        position={[-6.5, 12.5, 7.5]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-near={1}
        shadow-camera-far={32}
        shadow-bias={-0.00025}
        shadow-normalBias={0.025}
      />

      {/* 顶部中央补光 */}
      <pointLight
        position={TOP_SIDE_FILL_LIGHT.position}
        intensity={TOP_SIDE_FILL_LIGHT.intensity}
        color={TOP_SIDE_FILL_LIGHT.color}
        distance={TOP_SIDE_FILL_LIGHT.distance}
        decay={TOP_SIDE_FILL_LIGHT.decay}
      />

      
    </>
  );
}
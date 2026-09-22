import { Canvas, addAfterEffect, useThree, type CanvasProps } from '@react-three/fiber';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { isInitialSceneReady } from '../initialSceneReady';
import { tagTableRendererError } from '../rendererDiagnostics';
import { requestInitialFrameCommit, SceneSessionLifetime } from './initialFrameCommit';
import { SceneSessionContext } from './sceneSessionContext';

export type SceneCanvasHostProps = Readonly<{
  sessionKey: string;
  camera: CanvasProps['camera'];
  children: ReactNode;
  onReady?: () => void;
  onRendererReady?: () => void;
  onUnavailable?: (error: Error) => void;
}>;

/** Mode composition owns its camera, resources and contents. No player/state contract. */
export function SceneCanvasHost(props: SceneCanvasHostProps) {
  return <SceneCanvasSession key={props.sessionKey} {...props} />;
}

function SceneCanvasSession({ camera, children, onReady, onRendererReady, onUnavailable }: SceneCanvasHostProps) {
  const [rendererReady, setRendererReady] = useState(false);
  const [lifetime] = useState(() => new SceneSessionLifetime());
  useLayoutEffect(() => lifetime.activate(), [lifetime]);
  const context = useMemo(() => ({ rendererReady, lifetime, onReady }), [rendererReady, lifetime, onReady]);
  return (
    <Canvas
      shadows="basic"
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={camera}
      gl={(defaultProps) => {
        try {
          return new WebGLRenderer({ ...defaultProps, antialias: true, alpha: false, powerPreference: 'high-performance' });
        } catch (cause) {
          const error = tagTableRendererError(cause, 'webgl-init-failure');
          lifetime.guard(() => { lifetime.cancel(); onUnavailable?.(error); })();
          throw error;
        }
      }}
      fallback={<CanvasUnavailable />}
      onCreated={({ gl }) => {
        lifetime.guard(() => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFShadowMap;
          setRendererReady(true);
          onRendererReady?.();
        })();
      }}
    >
      <SceneSessionContext.Provider value={context}>
        <WebglContextLossRecovery onUnavailable={onUnavailable} />
        {children}
      </SceneSessionContext.Provider>
    </Canvas>
  );
}

/** Place inside the mode's resource boundary, after its critical scene layers. */
export function SceneContentReady({ sceneReady, criticalAssetsReady }: Readonly<{
  sceneReady: boolean;
  criticalAssetsReady: boolean;
}>) {
  const session = useContext(SceneSessionContext);
  if (!session) throw new Error('SceneContentReady 必须位于 SceneCanvasHost 内。');
  const { rendererReady, lifetime, onReady } = session;
  const { invalidate, gl } = useThree();
  const reportedRef = useRef(false);
  const ready = isInitialSceneReady({ rendererReady, tableSceneReady: sceneReady, criticalAssetsReady, localPresentationReady: true });
  useEffect(() => {
    if (!ready || reportedRef.current) return;
    const beforeFrame = gl.info.render.frame;
    return requestInitialFrameCommit({
      afterFrame: addAfterEffect,
      invalidate,
      hasRendered: () => gl.info.render.frame > beforeFrame,
      onReady: lifetime.guard(() => { reportedRef.current = true; onReady?.(); }),
    });
  }, [gl, invalidate, ready, lifetime, onReady]);
  return null;
}

/** Safely hand control back to the mode's existing failure UI. */
function WebglContextLossRecovery({ onUnavailable }: Readonly<{ onUnavailable?: (error: Error) => void }>) {
  const gl = useThree((state) => state.gl);
  const session = useContext(SceneSessionContext)!;
  useEffect(() => {
    const onContextLost = session.lifetime.guard((event: Event) => {
      event.preventDefault();
      session.lifetime.cancel();
      onUnavailable?.(tagTableRendererError(new Error('WebGL context lost while rendering appearance assets.'), 'webgl-init-failure'));
    });
    gl.domElement.addEventListener('webglcontextlost', onContextLost);
    return () => gl.domElement.removeEventListener('webglcontextlost', onContextLost);
  }, [gl, session.lifetime, onUnavailable]);
  return null;
}

export function CanvasUnavailable() {
  return <div className="table-3d-unavailable">当前设备无法启动 3D 牌桌，正在恢复经典牌桌。</div>;
}

/** Dev-only acceptance artifact. This is not a game mode or a 17-step scene. */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SceneCanvasHost, SceneContentReady } from '../src/presentation3d/session/SceneCanvasHost';
import { SceneErrorBoundary } from '../src/presentation3d/session/SceneErrorBoundary';
import { classifyTableRendererError } from '../src/presentation3d/rendererDiagnostics';
import { isInitialPresentationReady } from '../src/presentation3d/initialSceneReady';

function Fixture() {
  const [session, setSession] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [assets, setAssets] = useState(false);
  const [scene, setScene] = useState(false);
  const [local, setLocal] = useState(false);
  const [committed, setCommitted] = useState(-1);
  const [readyCalls, setReadyCalls] = useState(0);
  const [failure, setFailure] = useState('none');
  const [width, setWidth] = useState(700);
  const ready = isInitialPresentationReady(committed === session, local);
  return <main>
    <h1>共享宿主最小测试场景（不是17步）</h1>
    <output data-testid="status" data-session={session} data-ready={ready} data-commits={readyCalls} data-failure={failure}>
      {failure !== 'none' ? `故障回退：${failure}` : ready ? '完整帧与本家界面已就绪' : '等待就绪'}
    </output>
    <div>
      <button onClick={() => setScene(true)}>场景就绪</button>
      <button onClick={() => setAssets(true)}>资源就绪</button>
      <button onClick={() => setLocal(true)}>本家界面就绪</button>
      <button onClick={() => setWidth(value => value === 700 ? 500 : 700)}>调整尺寸</button>
      <button onClick={() => setMounted(value => !value)}>挂载或卸载</button>
      <button onClick={() => { setSession(value => value + 1); setMounted(true); setAssets(false); setScene(false); setLocal(false); setFailure('none'); }}>新会话</button>
      <button onClick={() => document.querySelector('canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()}>模拟上下文丢失</button>
    </div>
    <div style={{ width, height: 400 }}>
      {mounted && failure === 'none' ? <SceneErrorBoundary key={session} fallback={<p>渲染失败</p>} onError={error => setFailure(classifyTableRendererError(error))}>
        <SceneCanvasHost sessionKey={String(session)} camera={{ position: [0, 0, 5] }}
          onUnavailable={error => setFailure(classifyTableRendererError(error))}
          onReady={() => { setCommitted(session); setReadyCalls(value => value + 1); }}>
          <color attach="background" args={['#152b24']} />
          <mesh><boxGeometry /><meshBasicMaterial color="#dfc784" /></mesh>
          <SceneContentReady sceneReady={scene} criticalAssetsReady={assets} />
        </SceneCanvasHost>
      </SceneErrorBoundary> : null}
    </div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);

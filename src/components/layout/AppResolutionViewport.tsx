import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  resolutionConfigForPreset,
  type ResolutionConfig,
  type ResolutionPreset,
} from '../../app/appSettings';

export interface AppViewportSize {
  width: number;
  height: number;
}

export interface AppResolutionLayout {
  scale: number;
  scaledWidth: number;
  scaledHeight: number;
  belowSafeScale: boolean;
}

export interface AppResolutionContextValue extends AppResolutionLayout {
  active: boolean;
  preset: ResolutionPreset;
  config: ResolutionConfig;
  viewport: AppViewportSize;
}

const defaultViewport = { width: 1920, height: 1080 };
const defaultConfig = resolutionConfigForPreset('auto');
const AppResolutionContext = createContext<AppResolutionContextValue>({
  active: false,
  preset: 'auto',
  config: defaultConfig,
  viewport: defaultViewport,
  ...calculateAppResolutionLayout(defaultViewport.width, defaultViewport.height),
});

interface AppResolutionViewportProps {
  children: ReactNode;
  preset: ResolutionPreset;
  viewportSize?: AppViewportSize;
}

// Browser presets are preferences only. Layout always follows the actual CSS viewport.
export function calculateAppResolutionLayout(availableWidth: number, availableHeight: number): AppResolutionLayout {
  const width = Number.isFinite(availableWidth) && availableWidth > 0 ? availableWidth : defaultViewport.width;
  const height = Number.isFinite(availableHeight) && availableHeight > 0 ? availableHeight : defaultViewport.height;
  return { scale: 1, scaledWidth: width, scaledHeight: height, belowSafeScale: false };
}

export function AppResolutionViewport({ children, preset, viewportSize }: AppResolutionViewportProps) {
  const [measuredViewport, setMeasuredViewport] = useState<AppViewportSize>(() => viewportSize ?? browserViewport());

  useEffect(() => {
    if (viewportSize) {
      setMeasuredViewport(viewportSize);
      return undefined;
    }
    const update = () => setMeasuredViewport(browserViewport());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [viewportSize]);

  const viewport = viewportSize ?? measuredViewport;
  const config = resolutionConfigForPreset(preset);
  const layout = calculateAppResolutionLayout(viewport.width, viewport.height);
  const value = useMemo<AppResolutionContextValue>(() => ({
    active: true,
    preset,
    config,
    viewport,
    ...layout,
  }), [preset, config.width, config.height, viewport.width, viewport.height]);

  return (
    <AppResolutionContext.Provider value={value}>
      <div className="app-resolution-viewport" data-resolution-preset={preset}>
        {children}
      </div>
    </AppResolutionContext.Provider>
  );
}

export function useAppResolutionViewport(): AppResolutionContextValue {
  return useContext(AppResolutionContext);
}

function browserViewport(): AppViewportSize {
  if (typeof window === 'undefined') return defaultViewport;
  return { width: window.innerWidth, height: window.innerHeight };
}

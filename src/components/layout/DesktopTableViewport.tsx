import { useEffect, useRef, useState, type ReactNode } from 'react';

export const DESKTOP_TABLE_VIEWPORT = {
  logicalWidth: 1280,
  logicalHeight: 720,
  minimumWidth: 1280,
  minimumHeight: 720,
} as const;

export interface DesktopViewportSize {
  width: number;
  height: number;
}

interface DesktopTableViewportProps {
  children: ReactNode;
  surface: 'game' | 'replay' | 'test-mode' | 'settings';
  onReturnMenu?: () => void;
  viewportSize?: DesktopViewportSize;
}

export function calculateDesktopTableViewport(width: number, height: number): { supported: boolean; scale: number } {
  const supported = width >= DESKTOP_TABLE_VIEWPORT.minimumWidth && height >= DESKTOP_TABLE_VIEWPORT.minimumHeight;
  return { supported, scale: 1 };
}

export function DesktopTableViewport({ children, surface, onReturnMenu, viewportSize }: DesktopTableViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [measuredViewport, setMeasuredViewport] = useState<DesktopViewportSize>(() => viewportSize ?? browserViewport());

  useEffect(() => {
    if (viewportSize) {
      setMeasuredViewport(viewportSize);
      return undefined;
    }
    const host = hostRef.current;
    if (!host) return undefined;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setMeasuredViewport({ width: rect.width, height: rect.height });
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(host);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [viewportSize]);

  const viewport = viewportSize ?? measuredViewport;
  const layout = calculateDesktopTableViewport(viewport.width, viewport.height);
  if (!layout.supported) {
    return (
      <div
        ref={hostRef}
        className="desktop-table-surface desktop-table-viewport--unsupported"
        data-desktop-table-surface={surface}
        data-desktop-table-supported="false"
      >
        <section className="desktop-table-too-small" role="alert" aria-labelledby="desktop-table-too-small-title">
          <strong id="desktop-table-too-small-title">当前窗口尺寸过小</strong>
          <p>正式牌桌最低需要横屏 1280×720。</p>
          <p>请放大窗口或切换到满足要求的桌面显示器后重试。</p>
          {onReturnMenu ? <button type="button" onClick={onReturnMenu}>返回菜单</button> : null}
        </section>
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className="desktop-table-surface"
      data-desktop-table-surface={surface}
      data-desktop-table-supported="true"
      data-desktop-minimum-size={`${DESKTOP_TABLE_VIEWPORT.minimumWidth}x${DESKTOP_TABLE_VIEWPORT.minimumHeight}`}
    >
      {children}
    </div>
  );
}

function browserViewport(): DesktopViewportSize {
  if (typeof window === 'undefined') {
    return { width: DESKTOP_TABLE_VIEWPORT.minimumWidth, height: DESKTOP_TABLE_VIEWPORT.minimumHeight };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

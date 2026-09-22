import './sceneSession.css';
import { Component, type ErrorInfo, type ReactNode } from 'react';

export class SceneErrorBoundary extends Component<Readonly<{
  children: ReactNode;
  fallback: ReactNode;
  onError: (error: Error, info: ErrorInfo) => void;
}>, Readonly<{ failed: boolean }>> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) { this.props.onError(error, info); }

  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function SceneLoading() {
  return <div className="table-presentation-loading" role="status" aria-live="polite">
    <span>正在准备牌桌…</span>
  </div>;
}

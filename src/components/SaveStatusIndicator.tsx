import type { SaveStatus } from '../game/persistence/saveManager';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  savedAt?: string | null;
  error?: string | null;
}

export function SaveStatusIndicator({ status, savedAt, error }: SaveStatusIndicatorProps) {
  const text = status === 'saving'
    ? '正在保存'
    : status === 'saved'
      ? `已保存${savedAt ? ` ${savedAt}` : ''}`
      : status === 'error'
        ? `保存失败：${error ?? '未知错误'}`
        : '未保存';
  return <span className={`save-status save-status--${status}`}>{text}</span>;
}

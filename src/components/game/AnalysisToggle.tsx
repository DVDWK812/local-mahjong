interface AnalysisToggleProps {
  open: boolean;
  onToggle: () => void;
}

export function AnalysisToggle({ open, onToggle }: AnalysisToggleProps) {
  return (
    <button type="button" aria-label="打开牌局分析" aria-pressed={open} onClick={onToggle}>
      牌局分析
    </button>
  );
}

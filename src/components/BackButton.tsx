interface BackButtonProps {
  onClick: () => void;
}

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <button type="button" className="back-button" onClick={onClick}>
      返回
    </button>
  );
}

interface RiichiStickProps {
  orientation: 'horizontal' | 'vertical';
  active?: boolean;
}

export function RiichiStick({ orientation, active = false }: RiichiStickProps) {
  return (
    <div
      className={`riichi-stick-slot riichi-stick-slot--${orientation} ${active ? 'riichi-stick-slot--active' : ''}`}
      data-riichi-stick={orientation}
      data-active={active ? 'true' : 'false'}
      aria-hidden={!active}
    >
      {active ? (
        <svg className="riichi-stick" viewBox="0 0 120 16" role="img" aria-label="立直棒">
          <rect x="1" y="1" width="118" height="14" rx="7" fill="#fff8e8" stroke="#33423c" strokeWidth="2" />
          <circle cx="60" cy="8" r="4" fill="#d23b32" />
        </svg>
      ) : null}
    </div>
  );
}

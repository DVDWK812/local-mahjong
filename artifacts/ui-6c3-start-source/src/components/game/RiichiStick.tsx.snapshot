interface RiichiStickProps {
  orientation: 'horizontal' | 'vertical';
  active?: boolean;
}

export function RiichiStick({ orientation, active = false }: RiichiStickProps) {
  const isVertical = orientation === 'vertical';

  return (
    <div
      className={`riichi-stick-slot riichi-stick-slot--${orientation} ${active ? 'riichi-stick-slot--active' : ''}`}
      data-riichi-stick={orientation}
      data-active={active ? 'true' : 'false'}
      aria-hidden={!active}
    >
      {active ? (
        <svg className="riichi-stick" viewBox={isVertical ? '0 0 10 168' : '0 0 168 10'} role="img" aria-label="立直棒">
          <rect
            x="1"
            y="1"
            width={isVertical ? 8 : 166}
            height={isVertical ? 166 : 8}
            rx="5"
            fill="#fff8e8"
            stroke="#33423c"
            strokeWidth="1.5"
          />
          <circle cx={isVertical ? 5 : 84} cy={isVertical ? 84 : 5} r="4" fill="#d23b32" />
        </svg>
      ) : null}
    </div>
  );
}

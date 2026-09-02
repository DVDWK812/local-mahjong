import { useEffect, useMemo, useRef, useState, type MouseEventHandler, type PointerEventHandler } from 'react';
import { getTileAlt, getTileAltById, getTileBackImage, getTileImage, getTileImageById, getTilePlaceholderImage, isRedFive } from '../game/tileAssets';
import type { Tile as TileModel, TileId } from '../game/types';
import { suitClass } from '../game/tileUtils';
import {
  resolveTileDoraVisualKind,
  resolveTileVisualSemantics,
} from '../presentation/table/tileVisualSemantics';

interface TileProps {
  tile?: TileModel;
  id?: TileId;
  compact?: boolean;
  hidden?: boolean;
  faceDown?: boolean;
  sideways?: boolean;
  selected?: boolean;
  drawn?: boolean;
  riichiCandidate?: boolean;
  disabled?: boolean;
  clickable?: boolean;
  interactive?: boolean;
  doraIndicators?: TileModel[];
  doraGlowEnabled?: boolean;
  doraSweepEnabled?: boolean;
  hoveredTileType?: TileId | null;
  sameTileHoverEnabled?: boolean;
  onHoveredTileTypeChange?: (tileType: TileId | null) => void;
  className?: string;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function Tile({
  tile,
  id,
  compact = false,
  hidden = false,
  faceDown = false,
  sideways = false,
  selected = false,
  drawn = false,
  riichiCandidate = false,
  disabled = false,
  clickable,
  interactive = true,
  doraIndicators = [],
  doraGlowEnabled = false,
  doraSweepEnabled = false,
  hoveredTileType = null,
  sameTileHoverEnabled = false,
  onHoveredTileTypeChange,
  className,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onClick,
}: TileProps) {
  const isFaceDown = hidden || faceDown;
  const tileId = tile?.id ?? id;
  const source = useMemo(() => {
    if (isFaceDown) return getTileBackImage();
    if (tile) return getTileImage(tile);
    if (tileId !== undefined) return getTileImageById(tileId);
    return getTilePlaceholderImage();
  }, [isFaceDown, tile, tileId]);
  const [imageSource, setImageSource] = useState(source);
  const isHoverSourceRef = useRef(false);

  useEffect(() => {
    setImageSource(source);
  }, [source]);

  const alt = isFaceDown
    ? '牌背'
    : tile
      ? getTileAlt(tile)
      : tileId !== undefined
        ? getTileAltById(tileId)
        : '缺失牌图';
  const showRedBadge = !!tile && !isFaceDown && isRedFive(tile);
  const doraKind = isFaceDown ? null : resolveTileDoraVisualKind(tile, doraIndicators);
  const canReportHover = sameTileHoverEnabled && !isFaceDown && tileId !== undefined;
  const visualSemantics = resolveTileVisualSemantics({
    tileId,
    faceUp: !isFaceDown,
    doraKind,
    context: { hoveredTileType, sameTileHoverEnabled, doraGlowEnabled },
  });
  const doraGlowClass = doraGlowEnabled ? doraKind : null;
  const doraSweepClass = doraSweepEnabled && doraGlowClass
    ? [
        'local-hand-dora-sweep',
        'dora-breath-visual',
        visualSemantics.combinedHighlight ? 'dora-breath-visual--combined' : '',
        visualSemantics.dimmedByHoveredMatch ? 'dora-breath-visual--dimmed' : '',
      ].filter(Boolean).join(' ')
    : null;
  const sameTileHoverClass = canReportHover && visualSemantics.hoveredMatch
    ? 'tile--same-tile-match'
    : '';
  const isDisabled = disabled || (interactive && !onClick);
  const isPlayable = interactive && !isDisabled && Boolean(clickable || onClick);
  const tileState = selected
    ? 'selected'
    : riichiCandidate
      ? 'riichi-candidate'
      : drawn
        ? 'drawn'
        : isPlayable
          ? 'playable'
          : isDisabled
            ? 'disabled'
            : 'normal';
  const classNames = [
    'tile',
    compact ? 'tile--compact' : '',
    isFaceDown ? 'tile--hidden' : '',
    sideways ? 'tile--sideways' : '',
    selected ? 'tile--selected' : '',
    drawn ? 'tile--drawn' : '',
    riichiCandidate ? 'tile--riichi-candidate' : '',
    isPlayable ? 'tile--clickable tile--playable' : '',
    isDisabled ? 'tile--disabled' : '',
    tile ? suitClass(tile) : '',
    doraGlowClass ?? '',
    sameTileHoverClass,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    return () => {
      if (isHoverSourceRef.current) {
        onHoveredTileTypeChange?.(null);
      }
    };
  }, [onHoveredTileTypeChange]);

  const handlePointerEnter = () => {
    onPointerEnter?.();
    if (!canReportHover || tileId === undefined) return;
    isHoverSourceRef.current = true;
    onHoveredTileTypeChange?.(tileId);
  };

  const handlePointerLeave = () => {
    onPointerLeave?.();
    if (isHoverSourceRef.current) {
      isHoverSourceRef.current = false;
      onHoveredTileTypeChange?.(null);
    }
  };

  const content = (
    <span className="tile-face" onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <img
        className="tile-image"
        src={imageSource}
        alt={alt}
        draggable={false}
        onError={() => setImageSource(getTilePlaceholderImage())}
      />
      {doraSweepClass ? <span className={doraSweepClass} aria-hidden="true" /> : null}
      {showRedBadge ? <span className="tile-red-badge" aria-hidden="true" /> : null}
      {doraGlowClass ? <span className="tile-dora-frame" aria-hidden="true" /> : null}
    </span>
  );

  if (!interactive) {
    return (
      <span className={classNames} role="img" aria-label={alt} data-tile-state={tileState} data-drawn={drawn || undefined} data-riichi-candidate={riichiCandidate || undefined}>
        {content}
      </span>
    );
  }

  return (
    <button className={classNames} type="button" onPointerDown={onPointerDown} onClick={onClick} disabled={isDisabled} aria-label={alt} aria-pressed={selected || undefined} data-tile-state={tileState} data-drawn={drawn || undefined} data-riichi-candidate={riichiCandidate || undefined}>
      {content}
    </button>
  );
}

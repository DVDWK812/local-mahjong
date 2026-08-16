import { useEffect, useMemo, useRef, useState, type MouseEventHandler, type PointerEventHandler } from 'react';
import { getDoraGlowClass } from '../game/doraVisual';
import { getTileAlt, getTileAltById, getTileBackImage, getTileImage, getTileImageById, getTilePlaceholderImage, isRedFive } from '../game/tileAssets';
import type { Tile as TileModel, TileId } from '../game/types';
import { suitClass } from '../game/tileUtils';

interface TileProps {
  tile?: TileModel;
  id?: TileId;
  compact?: boolean;
  hidden?: boolean;
  faceDown?: boolean;
  sideways?: boolean;
  selected?: boolean;
  disabled?: boolean;
  clickable?: boolean;
  interactive?: boolean;
  doraIndicators?: TileModel[];
  doraGlowEnabled?: boolean;
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
  disabled = false,
  clickable,
  interactive = true,
  doraIndicators = [],
  doraGlowEnabled = false,
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
  const doraGlowClass = isFaceDown ? null : getDoraGlowClass(tile, doraIndicators, doraGlowEnabled);
  const canReportHover = sameTileHoverEnabled && !isFaceDown && tileId !== undefined;
  const sameTileHoverClass = canReportHover && hoveredTileType === tileId ? 'tile--same-tile-match' : '';
  const isDisabled = disabled || !onClick;
  const classNames = [
    'tile',
    compact ? 'tile--compact' : '',
    isFaceDown ? 'tile--hidden' : '',
    sideways ? 'tile--sideways' : '',
    selected ? 'tile--selected' : '',
    clickable || onClick ? 'tile--clickable' : '',
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
      {showRedBadge ? <span className="tile-red-badge" aria-hidden="true" /> : null}
      {doraGlowClass ? <span className="tile-dora-frame" aria-hidden="true" /> : null}
    </span>
  );

  if (!interactive) {
    return (
      <span className={classNames} role="img" aria-label={alt}>
        {content}
      </span>
    );
  }

  return (
    <button className={classNames} type="button" onPointerDown={onPointerDown} onClick={onClick} disabled={isDisabled} aria-label={alt}>
      {content}
    </button>
  );
}

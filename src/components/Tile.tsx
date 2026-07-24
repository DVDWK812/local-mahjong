import { useEffect, useMemo, useState } from 'react';
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
  className?: string;
  onClick?: () => void;
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
  className,
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
  const isDisabled = disabled || !onClick;
  const classNames = [
    'tile',
    compact ? 'tile--compact' : '',
    isFaceDown ? 'tile--hidden' : '',
    sideways ? 'tile--sideways' : '',
    selected ? 'tile--selected' : '',
    clickable || onClick ? 'tile--clickable' : '',
    tile ? suitClass(tile) : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classNames} type="button" onClick={onClick} disabled={isDisabled} aria-label={alt}>
      <img
        className="tile-image"
        src={imageSource}
        alt={alt}
        draggable={false}
        onError={() => setImageSource(getTilePlaceholderImage())}
      />
      {showRedBadge ? <span className="tile-red-badge" aria-hidden="true" /> : null}
    </button>
  );
}

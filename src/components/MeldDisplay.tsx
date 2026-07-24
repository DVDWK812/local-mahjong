import type { MeldDisplayModel } from '../game/meldDisplayAdapter';
import { Tile } from './Tile';

interface MeldDisplayProps {
  meld: MeldDisplayModel;
  seatClass?: string;
}

const CALL_LABELS: Record<MeldDisplayModel['callType'], string> = {
  chi: '吃',
  pon: '碰',
  ankan: '暗杠',
  minkan: '大明杠',
  kakan: '加杠',
};

const SOURCE_LABELS: Record<MeldDisplayModel['sourceRelation'], string> = {
  left: '左家',
  opposite: '对家',
  right: '右家',
  self: '自己',
};

export function MeldDisplay({ meld, seatClass = '' }: MeldDisplayProps) {
  const sourceText = meld.callType === 'ankan'
    ? '暗杠'
    : `${CALL_LABELS[meld.callType]} · 来自${SOURCE_LABELS[meld.sourceRelation]}`;
  return (
    <div className={`meld-display ${seatClass}`} aria-label={sourceText} title={sourceText} data-call-type={meld.callType}>
      {meld.tiles.map((displayTile) => (
        <div
          key={displayTile.instanceId}
          className={[
            'meld-tile',
            displayTile.sideways ? 'meld-tile--sideways' : '',
            displayTile.stacked ? 'meld-tile--stacked' : '',
          ].filter(Boolean).join(' ')}
          data-sideways={displayTile.sideways ? 'true' : 'false'}
          data-stacked={displayTile.stacked ? 'true' : 'false'}
          data-called={displayTile.called ? 'true' : 'false'}
          data-face-down={displayTile.faceDown ? 'true' : 'false'}
        >
          <Tile tile={displayTile.tile} faceDown={displayTile.faceDown} sideways={displayTile.sideways} compact />
        </div>
      ))}
    </div>
  );
}

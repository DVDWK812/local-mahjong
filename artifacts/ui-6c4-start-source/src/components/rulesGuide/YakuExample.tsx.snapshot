import { callToMeldDisplayModel } from '../../game/meldDisplayAdapter';
import type { GuideTile, GuideYakuExample } from '../../game/rulesGuide/yakuCatalog';
import type { Tile as TileModel } from '../../game/types';
import { getTileRank, getTileSuit } from '../../game/tileUtils';
import { Tile } from '../Tile';

interface YakuExampleProps {
  example: GuideYakuExample;
}

function toTile(tile: GuideTile, index: number): TileModel {
  return {
    id: tile.id,
    suit: getTileSuit(tile.id),
    rank: getTileRank(tile.id),
    red: !!tile.red,
    instanceId: `rules-guide-${tile.id}-${index}-${tile.red ? 'red' : 'plain'}`,
  };
}

export function YakuExample({ example }: YakuExampleProps) {
  const handTiles = example.hand.map(toTile);
  const winningTile = toTile(example.winningTile, 99);

  return (
    <div className="rules-example">
      <div className="rules-example-row">
        <span>手牌</span>
        <div className="rules-tile-line">
          {handTiles.map((tile) => <Tile key={tile.instanceId} tile={tile} compact interactive={false} />)}
        </div>
      </div>
      <div className="rules-example-row">
        <span>和牌张</span>
        <div className="rules-tile-line">
          <Tile tile={winningTile} compact interactive={false} />
        </div>
      </div>
      <div className="rules-example-row">
        <span>副露</span>
        <div className="rules-meld-line">
          {example.melds?.length
            ? example.melds.map((meld, index) => <ReadonlyMeld key={`${meld.type}-${index}`} model={callToMeldDisplayModel(meld, 0, index)} />)
            : <em>无</em>}
        </div>
      </div>
      {example.note ? <p>{example.note}</p> : null}
    </div>
  );
}

function ReadonlyMeld({ model }: { model: ReturnType<typeof callToMeldDisplayModel> }) {
  return (
    <div className="meld-display rules-meld" data-call-type={model.callType}>
      {model.tiles.map((displayTile) => (
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
          <Tile tile={displayTile.tile} faceDown={displayTile.faceDown} sideways={displayTile.sideways} compact interactive={false} />
        </div>
      ))}
    </div>
  );
}

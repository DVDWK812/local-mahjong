import { createContext } from 'react';
import type { TileId } from '../../game/types';
/** Authoritative mode adapter supplies identities, never fabricated indicator tiles. */
export const TileDoraContext = createContext<readonly TileId[] | undefined>(undefined);

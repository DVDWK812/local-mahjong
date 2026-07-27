import type { MatchLength } from '../game/match/types';

export type AppScreen =
  | 'main-menu'
  | 'local-mode-menu'
  | 'riichi-player-count'
  | 'riichi-four-player-length'
  | 'riichi-three-player-length'
  | 'match-settings'
  | 'rules-guide'
  | 'game'
  | 'replay-library'
  | 'replay';

export type PlayerCount = 3 | 4;
export type RiichiLengthChoice = 'four-east' | 'four-south' | 'three-east' | 'three-south';

export interface SetupSelection {
  playerCount?: PlayerCount;
  lengthChoice?: RiichiLengthChoice;
}

export function matchLengthForChoice(choice: RiichiLengthChoice): MatchLength {
  return choice === 'four-east' || choice === 'three-east' ? 'east-only' : 'hanchan';
}

export function presetForChoice(choice: RiichiLengthChoice): 'east-round' | 'south-round' {
  return matchLengthForChoice(choice) === 'east-only' ? 'east-round' : 'south-round';
}

export function pathLabel(selection: SetupSelection): string {
  const parts = ['本地模式', '立直麻将'];
  if (selection.playerCount === 4) parts.push('四人间');
  if (selection.playerCount === 3) parts.push('三人间');
  if (selection.lengthChoice === 'four-east') parts.push('四人东');
  if (selection.lengthChoice === 'four-south') parts.push('四人南');
  if (selection.lengthChoice === 'three-east') parts.push('三人东');
  if (selection.lengthChoice === 'three-south') parts.push('三人南');
  return parts.join(' ＞ ');
}

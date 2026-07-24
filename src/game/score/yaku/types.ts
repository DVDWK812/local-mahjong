export type YakuCategory = 'normal' | 'yakuman' | 'double_yakuman';

export interface YakuResult {
  name: string;
  category: YakuCategory;
  han?: number;
  yakuman?: boolean;
  yakumanValue?: number;
  closedHan?: number;
  openHan?: number;
  openAllowed: boolean;
}

export function normalYaku(name: string, han: number, openAllowed: boolean, closedHan?: number, openHan?: number): YakuResult {
  return {
    name,
    category: 'normal',
    han,
    closedHan,
    openHan,
    openAllowed,
  };
}

export function yakumanYaku(name: string, yakumanValue = 1): YakuResult {
  return {
    name,
    category: yakumanValue >= 2 ? 'double_yakuman' : 'yakuman',
    yakuman: true,
    yakumanValue,
    openAllowed: true,
  };
}

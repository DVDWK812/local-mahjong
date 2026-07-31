export type TripleRonMode = 'allow' | 'abortive-draw';

export interface RuleConfig {
  allowAncientYaku: boolean;
  allowDoubleYakuman: boolean;
  multipleYakuman: boolean;
  akaDora: boolean;
  ippatsu: boolean;
  doubleWindPairFu: boolean;
  allowOpenTanyao: boolean;
  kiriageMangan: boolean;
  kazoeYakumanMode: 'disabled' | 'sanbaiman' | 'yakuman';
  allowKyuushuKyuuhai: boolean;
  abortOnFourWinds: boolean;
  abortOnFourRiichi: boolean;
  abortOnFourKans: boolean;
  tripleRonMode: TripleRonMode;
  allowKokushiChankanAnkan: boolean;
  dealerContinuesOnTenpaiDraw: boolean;
  revealTenpaiHandsOnDraw: boolean;
  preserveClaimedDiscardGap: boolean;
  forbidKuikae: boolean;
}

export const defaultRuleConfig: RuleConfig = {
  allowAncientYaku: false,
  allowDoubleYakuman: true,
  multipleYakuman: true,
  akaDora: true,
  ippatsu: true,
  doubleWindPairFu: true,
  allowOpenTanyao: true,
  kiriageMangan: false,
  kazoeYakumanMode: 'yakuman',
  allowKyuushuKyuuhai: true,
  abortOnFourWinds: true,
  abortOnFourRiichi: true,
  abortOnFourKans: true,
  tripleRonMode: 'allow',
  allowKokushiChankanAnkan: true,
  dealerContinuesOnTenpaiDraw: true,
  revealTenpaiHandsOnDraw: true,
  preserveClaimedDiscardGap: false,
  forbidKuikae: true,
};

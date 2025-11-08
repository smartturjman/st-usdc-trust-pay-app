export type Split = { partnerBps: number; platformBps: number };

export const DEFAULT_SPLIT: Split = { partnerBps: 9000, platformBps: 1000 };

export function calcSplit(amountUSDC: number, split: Split) {
  const partner = +(amountUSDC * split.partnerBps / 10000).toFixed(2);
  const platform = +(amountUSDC - partner).toFixed(2);
  return { partnerUSDC: partner, platformUSDC: platform };
}

export type Currency = {
  large: number;
  small: number;
  golden: number;
};

export type FamilyRates = {
  smallPerLarge: number;
  largeCashValue: number;
  goldenCashValue: number;
  largeMinutes: number;
  smallMinutes: number;
  goldenMinutes: number;
};

export function toMinutes(bal: Currency, rates: FamilyRates): number {
  return (
    bal.large  * rates.largeMinutes  +
    bal.small  * rates.smallMinutes  +
    bal.golden * rates.goldenMinutes
  );
}

// Small coins (Ginseys) are NOT cashable — intentional design rule
export function toCashValue(bal: Currency, rates: FamilyRates): number {
  return (
    bal.large  * rates.largeCashValue  +
    bal.golden * rates.goldenCashValue
  );
}

export function normalise(bal: Currency, rates: FamilyRates): Currency {
  const extraLarge = Math.floor(bal.small / rates.smallPerLarge);
  return {
    large:  bal.large + extraLarge,
    small:  bal.small % rates.smallPerLarge,
    golden: bal.golden,
  };
}

export function minutesToCost(minutes: number, rates: FamilyRates): Currency {
  let remaining = minutes;
  const golden = Math.floor(remaining / rates.goldenMinutes);
  remaining -= golden * rates.goldenMinutes;
  const large  = Math.floor(remaining / rates.largeMinutes);
  remaining -= large * rates.largeMinutes;
  const small  = Math.ceil(remaining / rates.smallMinutes);
  return { large, small, golden };
}

import { CountryNews } from "./types";

export const G7_CODES = ["jp", "us", "gb", "de", "fr", "it", "ca"] as const;
export const MAJOR_ECONOMY_CODES = ["cn", "in"] as const;

const G7_SET = new Set<string>(G7_CODES);
const MAJOR_ECONOMY_SET = new Set<string>(MAJOR_ECONOMY_CODES);

export const TOTAL_COUNTRY_COUNT = G7_CODES.length + MAJOR_ECONOMY_CODES.length;

export function partitionCountries(countries: CountryNews[]) {
  const g7 = countries.filter((c) => G7_SET.has(c.code));
  const majorEconomies = countries.filter((c) => MAJOR_ECONOMY_SET.has(c.code));
  return { g7, majorEconomies };
}

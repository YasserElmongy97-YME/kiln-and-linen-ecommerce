export const COUNTRIES = [
  { code: "EG", name: "Egypt" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
] as const;

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [string, ...string[]];

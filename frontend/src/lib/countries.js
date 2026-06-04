// Country helpers shared across Dashboard / Pipeline / Detail Sheet.
// YouTube's snippet.country uses ISO 3166-1 alpha-2 codes (e.g. "GB" for the UK).

// Top ~100 codes most likely to appear on YouTube. Anything not in this map
// will fall back to displaying the raw ISO code.
export const COUNTRY_NAMES = {
  US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia", NZ: "New Zealand",
  IE: "Ireland", ZA: "South Africa", IN: "India", PK: "Pakistan", PH: "Philippines",
  SG: "Singapore", MY: "Malaysia", HK: "Hong Kong", JP: "Japan", KR: "South Korea",
  CN: "China", TW: "Taiwan", TH: "Thailand", VN: "Vietnam", ID: "Indonesia",
  AE: "United Arab Emirates", SA: "Saudi Arabia", IL: "Israel", TR: "Turkey", EG: "Egypt",
  NG: "Nigeria", KE: "Kenya", GH: "Ghana", MA: "Morocco",
  BR: "Brazil", MX: "Mexico", AR: "Argentina", CL: "Chile", CO: "Colombia",
  PE: "Peru", VE: "Venezuela", UY: "Uruguay", EC: "Ecuador",
  DE: "Germany", FR: "France", ES: "Spain", IT: "Italy", PT: "Portugal",
  NL: "Netherlands", BE: "Belgium", LU: "Luxembourg", CH: "Switzerland", AT: "Austria",
  SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland", IS: "Iceland",
  PL: "Poland", CZ: "Czechia", SK: "Slovakia", HU: "Hungary", RO: "Romania",
  BG: "Bulgaria", GR: "Greece", HR: "Croatia", SI: "Slovenia", RS: "Serbia",
  UA: "Ukraine", RU: "Russia", BY: "Belarus", EE: "Estonia", LV: "Latvia",
  LT: "Lithuania", MT: "Malta", CY: "Cyprus", LI: "Liechtenstein", MC: "Monaco",
  AL: "Albania", BA: "Bosnia & Herzegovina", MK: "North Macedonia", ME: "Montenegro", MD: "Moldova",
  GE: "Georgia", AM: "Armenia", AZ: "Azerbaijan", KZ: "Kazakhstan", UZ: "Uzbekistan",
  BD: "Bangladesh", LK: "Sri Lanka", NP: "Nepal", MM: "Myanmar", KH: "Cambodia",
  LA: "Laos", BN: "Brunei", MN: "Mongolia",
  IR: "Iran", IQ: "Iraq", JO: "Jordan", LB: "Lebanon", KW: "Kuwait",
  QA: "Qatar", BH: "Bahrain", OM: "Oman", YE: "Yemen", SY: "Syria",
  ET: "Ethiopia", TZ: "Tanzania", UG: "Uganda", DZ: "Algeria", TN: "Tunisia",
};

// EU 27 member states (ISO codes)
export const EU_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

// Common business English-speaking countries
export const ENGLISH_SPEAKING = ["US", "GB", "CA", "AU", "NZ", "IE", "ZA"];

export const COUNTRY_PRESETS = [
  { id: "usa", label: "USA", flag: "🇺🇸", codes: ["US"] },
  { id: "uk", label: "UK", flag: "🇬🇧", codes: ["GB"] },
  { id: "eu", label: "EU", flag: "🇪🇺", codes: EU_COUNTRIES },
  { id: "english", label: "English-speaking", flag: "🌍", codes: ENGLISH_SPEAKING },
];

// Convert an ISO 3166-1 alpha-2 code into its flag emoji.
// Works for any valid code by mapping each letter to its regional indicator symbol.
export function flagEmoji(code) {
  if (!code || typeof code !== "string" || code.length !== 2) return "";
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countryName(code) {
  if (!code) return "";
  const cc = code.toUpperCase();
  return COUNTRY_NAMES[cc] || cc;
}

// Sorted alphabetical list, used for "All countries" select.
export const ALL_COUNTRIES = Object.keys(COUNTRY_NAMES)
  .map((code) => ({ code, name: COUNTRY_NAMES[code], flag: flagEmoji(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

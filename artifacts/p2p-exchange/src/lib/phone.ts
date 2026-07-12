import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";
import type { Country } from "./countries";

/**
 * Whether `nationalDigits` (as typed by the user, digits only, may or may not
 * include a leading trunk "0") is a valid number for `country`.
 */
export function isPhoneValidForCountry(nationalDigits: string, country: Country): boolean {
  if (!nationalDigits) return false;
  try {
    return isValidPhoneNumber(nationalDigits, country.code as any);
  } catch {
    return false;
  }
}

/**
 * Normalizes a national number + country into the bare national significant
 * number (no leading trunk prefix), suitable for concatenating with the
 * country's E.164 dial code before sending to the backend / storing.
 * Falls back to a simple leading-zero strip if the library can't parse it
 * (should only happen for numbers that already failed validation).
 */
export function normalizeNationalNumber(nationalDigits: string, country: Country): string {
  try {
    const parsed = parsePhoneNumberFromString(nationalDigits, country.code as any);
    if (parsed) return parsed.nationalNumber;
  } catch {
    // fall through
  }
  return nationalDigits.replace(/^0+/, "");
}

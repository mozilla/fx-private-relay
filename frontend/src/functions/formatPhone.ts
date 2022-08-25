import {
  formatPhoneNumber,
  getCountryCallingCode,
  parsePhoneNumber,
} from "react-phone-number-input";
/**
 * E.164 number as a string.
 * Example +13337891234
 * E.164 is an international numbering plan for public telephone systems in which each assigned number
 * contains a country code (CC), a national destination code (NDC), and a subscriber number (SN).
 * There can be up to 15 digits in an E.164 number.
 */
export type PhoneString = string;

/**
 * Make sure that when we format phone numbers in a consistent way.
 */
export function formatPhone(phoneNumber: PhoneString) {
  const parsedNumber = parsePhoneNumber(phoneNumber);

  // This only checks for valid length of the phone number.
  // Ex: ('+12223333333') === true
  if (!parsedNumber?.isPossible()) {
    // This does not take into account two digit country codes.
    // The purpose is to show users a consistent format, even for invalid phone numbers.
    // Ex: input of +122244 will be formatted as +1 (222) 44-
    return `${phoneNumber.substring(0, 2)} (${phoneNumber.substring(
      2,
      5
    )}) ${phoneNumber.substring(5, 8)}-${phoneNumber.substring(8, 12)}`;
  }

  // formats the phone number to +X (XXX) XXX-XXXX
  return parsedNumber?.country
    ? `+${getCountryCallingCode(parsedNumber.country)} ${formatPhoneNumber(
        phoneNumber
      )}`
    : "";
}

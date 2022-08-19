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

  // formats the phone number to +X (XXX) XXX-XXXX
  return parsedNumber?.country
    ? `+${getCountryCallingCode(parsedNumber.country)} ${formatPhoneNumber(
        phoneNumber
      )}`
    : "";
}

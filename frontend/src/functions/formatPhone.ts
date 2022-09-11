/**
 * Make sure that when we format phone numbers in a consistent way.
 * phoneNumber: The phone number to format.
 * withCountryCode: Whether to include the country code in the formatted number.
 */
export function formatPhone(
  phoneNumber: string,
  withCountryCode?: false
): string {
  // remove country code by default, but allow it to be included
  // remove all none numeric characters
  // incluse first 10 digits
  const phone = (!withCountryCode ? phoneNumber.replace("+1", "") : phoneNumber)
    .replace(/\D/g, "")
    .substring(0, 10);

  // add country code to zip code block if specified
  const zip = withCountryCode
    ? `+1${phone.substring(0, 3)}`
    : phone.substring(0, 3);
  const middle = phone.substring(3, 6);
  const last = phone.substring(6, 10);

  return phone.length > 6
    ? `(${zip}) ${middle} - ${last}`
    : phone.length > 3
    ? `(${zip}) ${middle}`
    : phone.length > 0
    ? `(${zip}`
    : "";
}

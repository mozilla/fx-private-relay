import { formatPhone } from "./formatPhone";

it("returns a formatted number even if not a valid length", () => {
  const phoneNumber = "+122244";

  expect(formatPhone(phoneNumber)).toBe("(222) 44");
});

it("returns a formatted number with or without a country code", () => {
  const phoneNumberWithCountryCode = "+12505551234";
  const phoneNumberWithoutCountryCode = "2505551234";

  expect(formatPhone(phoneNumberWithCountryCode)).toBe("(250) 555 - 1234");
  expect(formatPhone(phoneNumberWithoutCountryCode)).toBe("(250) 555 - 1234");
});

it("returns a formatted number with country code if requested", () => {
  const phoneNumberWithCountryCode = "+12505551234";
  const phoneNumberWithoutCountryCode = "2505551234";

  expect(formatPhone(phoneNumberWithCountryCode, true)).toBe(
    "+1 (250) 555 - 1234"
  );
  expect(formatPhone(phoneNumberWithoutCountryCode, true)).toBe(
    "+1 (250) 555 - 1234"
  );
});

it("returns a formatted number ", () => {
  const phoneNumberWithCountryCode = "+1 (250) 555 - 1234";
  const phoneNumberWithoutCountryCode = "(250) 555 - 1234";

  expect(formatPhone(phoneNumberWithCountryCode, true)).toBe(
    "+1 (250) 555 - 1234"
  );
  expect(formatPhone(phoneNumberWithCountryCode)).toBe("(250) 555 - 1234");
  expect(formatPhone(phoneNumberWithoutCountryCode, true)).toBe(
    "+1 (250) 555 - 1234"
  );
  expect(formatPhone(phoneNumberWithoutCountryCode)).toBe("(250) 555 - 1234");
});

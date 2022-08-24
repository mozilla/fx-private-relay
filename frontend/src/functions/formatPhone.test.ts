import { formatPhone } from "./formatPhone";

it("returns a formatted number even if not a valid length", () => {
  const phoneNumber = "+122244";

  expect(formatPhone(phoneNumber)).toBe("+1 (222) 44-");
});

it("returns a formatted number if it is a valid length", () => {
  const phoneNumber = "+12505551234";

  expect(formatPhone(phoneNumber)).toBe("+1 (250) 555-1234");
});

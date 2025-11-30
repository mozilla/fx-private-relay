import { getCookie, setCookie, clearCookie, getCsrfToken } from "./cookies";

describe("cookies", () => {
  beforeEach(() => {
    // Clear all cookies before each test
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
  });

  describe("getCookie", () => {
    it("returns undefined when cookie does not exist", () => {
      expect(getCookie("nonexistent")).toBeUndefined();
    });

    it("returns the cookie value when cookie exists", () => {
      document.cookie = "testcookie=testvalue; path=/";
      expect(getCookie("testcookie")).toBe("testvalue");
    });

    it("returns the correct cookie when multiple cookies exist", () => {
      document.cookie = "cookie1=value1; path=/";
      document.cookie = "cookie2=value2; path=/";
      expect(getCookie("cookie2")).toBe("value2");
    });

    it("handles cookies with spaces in the cookie string", () => {
      document.cookie = "test=value; path=/";
      expect(getCookie("test")).toBe("value");
    });
  });

  describe("setCookie", () => {
    it("sets a cookie without maxAge", () => {
      setCookie("newcookie", "newvalue");
      expect(document.cookie).toContain("newcookie=newvalue");
    });

    it("sets a cookie with maxAge", () => {
      setCookie("timecookie", "timevalue", { maxAgeInSeconds: 3600 });
      expect(document.cookie).toContain("timecookie=timevalue");
    });

    it("overwrites existing cookie value", () => {
      setCookie("overwrite", "original");
      setCookie("overwrite", "updated");
      expect(getCookie("overwrite")).toBe("updated");
    });
  });

  describe("clearCookie", () => {
    it("clears an existing cookie", () => {
      document.cookie = "toclear=value; path=/";
      expect(getCookie("toclear")).toBe("value");

      clearCookie("toclear");

      // Cookie should be cleared (maxAge set to 0)
      // Note: In jsdom, the cookie might still appear but with expired max-age
      const afterClear = getCookie("toclear");
      // After clearing, cookie should either be undefined or empty
      expect(afterClear === undefined || afterClear === "").toBe(true);
    });
  });

  describe("getCsrfToken", () => {
    it("returns undefined when csrftoken cookie does not exist", () => {
      expect(getCsrfToken()).toBeUndefined();
    });

    it("returns the csrftoken value when it exists", () => {
      document.cookie = "csrftoken=abc123; path=/";
      expect(getCsrfToken()).toBe("abc123");
    });
  });
});

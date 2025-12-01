import { getRuntimeConfig } from "./config";

describe("config", () => {
  describe("getRuntimeConfig", () => {
    it("returns publicRuntimeConfig from next/config", () => {
      const result = getRuntimeConfig();

      // Verify the result has the expected structure and required fields
      expect(result).toHaveProperty("backendOrigin");
      expect(result).toHaveProperty("frontendOrigin");
      expect(result).toHaveProperty("fxaLoginUrl");
      expect(result).toHaveProperty("fxaLogoutUrl");
      expect(result).toHaveProperty("supportUrl");
      expect(result).toHaveProperty("emailSizeLimitNumber");
      expect(result).toHaveProperty("emailSizeLimitUnit");
      expect(result).toHaveProperty("maxFreeAliases");
      expect(result).toHaveProperty("mozmailDomain");
      expect(result).toHaveProperty("googleAnalyticsId");
      expect(result).toHaveProperty("maxOnboardingAvailable");
      expect(result).toHaveProperty("maxOnboardingFreeAvailable");
      expect(result).toHaveProperty("featureFlags");

      // Verify feature flags structure
      expect(result.featureFlags).toHaveProperty("tips");
      expect(result.featureFlags).toHaveProperty("generateCustomAliasMenu");
      expect(result.featureFlags).toHaveProperty(
        "generateCustomAliasSubdomain",
      );
      expect(result.featureFlags).toHaveProperty("interviewRecruitment");
      expect(result.featureFlags).toHaveProperty("csatSurvey");

      // Verify types
      expect(typeof result.backendOrigin).toBe("string");
      expect(typeof result.maxFreeAliases).toBe("number");
      expect(result.mozmailDomain).toBe("mozmail.com");
    });

    it("returns consistent config on multiple calls", () => {
      const firstCall = getRuntimeConfig();
      const secondCall = getRuntimeConfig();

      expect(firstCall).toEqual(secondCall);
    });

    it("returns all URL fields as strings", () => {
      const result = getRuntimeConfig();

      expect(typeof result.backendOrigin).toBe("string");
      expect(typeof result.frontendOrigin).toBe("string");
      expect(typeof result.fxaLoginUrl).toBe("string");
      expect(typeof result.fxaLogoutUrl).toBe("string");
      expect(typeof result.supportUrl).toBe("string");
    });

    it("returns all numeric fields as numbers", () => {
      const result = getRuntimeConfig();

      expect(typeof result.emailSizeLimitNumber).toBe("number");
      expect(typeof result.maxFreeAliases).toBe("number");
      expect(typeof result.maxOnboardingAvailable).toBe("number");
      expect(typeof result.maxOnboardingFreeAvailable).toBe("number");
    });

    it("returns feature flags as booleans", () => {
      const result = getRuntimeConfig();

      expect(typeof result.featureFlags.tips).toBe("boolean");
      expect(typeof result.featureFlags.generateCustomAliasMenu).toBe(
        "boolean",
      );
      expect(typeof result.featureFlags.generateCustomAliasSubdomain).toBe(
        "boolean",
      );
      expect(typeof result.featureFlags.interviewRecruitment).toBe("boolean");
      expect(typeof result.featureFlags.csatSurvey).toBe("boolean");
    });
  });
});

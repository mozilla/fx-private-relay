import { jest } from "@jest/globals";
import type { RuntimeConfig } from "../src/config";

export const mockConfigModule = {
  getRuntimeConfig: jest.fn<RuntimeConfig, []>(() => {
    return {
      backendOrigin: "https://backend.example.com",
      frontendOrigin: "https://frontend.example.com",
      fxaOrigin: "https://accounts.example.com",
      fxaLoginUrl: "https://accounts.example.com/login/",
      fxaLogoutUrl: "https://accounts.example.com/logout/",
      premiumProductId: "prod_X00XXXX0xXX0Xx",
      emailSizeLimitNumber: 10,
      emailSizeLimitUnit: "MB",
      maxFreeAliases: 5,
      mozmailDomain: "mozmail.com",
      googleAnalyticsId: "UA-00000000-00",
      maxOnboardingAvailable: 3,
      featureFlags: {
        generateCustomAlias: false,
      },
    };
  }),
};

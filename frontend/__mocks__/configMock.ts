import type { RuntimeConfig } from "../src/config";

export const mockConfigModule = {
  getRuntimeConfig: jest.fn<RuntimeConfig, []>(() => {
    return {
      backendOrigin: "https://backend.example.com",
      frontendOrigin: "https://frontend.example.com",
      fxaOrigin: "https://accounts.example.com",
      fxaLoginUrl: "https://accounts.example.com/login/",
      fxaLogoutUrl: "https://accounts.example.com/logout/",
      supportUrl: "https://support.example.com/products/relay",
      premiumProductId: "prod_X00XXXX0xXX0Xx",
      emailSizeLimitNumber: 10,
      emailSizeLimitUnit: "MB",
      maxFreeAliases: 5,
      mozmailDomain: "mozmail.com",
      googleAnalyticsId: "UA-00000000-00",
      maxOnboardingAvailable: 3,
      maxOnboardingFreeAvailable: 3,
      featureFlags: {
        tips: false,
        generateCustomAliasMenu: false,
        generateCustomAliasSubdomain: false,
        interviewRecruitment: false,
        csatSurvey: false,
      },
    };
  }),
};

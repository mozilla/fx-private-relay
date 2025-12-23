// Configuration objects for different environments
const productionConfig: RuntimeConfig = {
  backendOrigin: "",
  frontendOrigin: "",
  fxaLoginUrl: "/accounts/fxa/login/?process=login",
  fxaLogoutUrl: "/accounts/logout/",
  supportUrl: "https://support.mozilla.org/products/relay",
  emailSizeLimitNumber: 10,
  emailSizeLimitUnit: "MB",
  maxFreeAliases: 5,
  mozmailDomain: "mozmail.com",
  googleAnalyticsId: "UA-77033033-33",
  maxOnboardingAvailable: 3,
  maxOnboardingFreeAvailable: 3,
  featureFlags: {
    tips: true,
    generateCustomAliasMenu: true,
    generateCustomAliasSubdomain: false,
    interviewRecruitment: true,
    csatSurvey: true,
  },
};

const developmentConfig: RuntimeConfig = {
  ...productionConfig,
  backendOrigin: "http://127.0.0.1:8000",
  frontendOrigin: "http://localhost:3000",
  fxaLoginUrl: "http://localhost:3000/mock/login",
  fxaLogoutUrl: "http://localhost:3000/mock/logout",
};

const apimockConfig: RuntimeConfig = {
  ...productionConfig,
  backendOrigin: "",
  frontendOrigin: "",
  fxaLoginUrl: "/mock/login",
  fxaLogoutUrl: "/mock/logout",
};

const runtimeConfigs: Record<string, RuntimeConfig> = {
  production: productionConfig,
  development: developmentConfig,
  apimock: apimockConfig,
};

// Determines which config to use based on environment variables
export function getRuntimeConfig(): RuntimeConfig {
  let applicableConfig = "production";

  if (process.env.NEXT_PUBLIC_MOCK_API === "true") {
    applicableConfig = "apimock";
  }
  if (process.env.NODE_ENV === "development") {
    applicableConfig = "development";
  }

  return runtimeConfigs[applicableConfig];
}

type FeatureFlags = {
  tips: boolean;
  generateCustomAliasMenu: boolean;
  generateCustomAliasSubdomain: boolean;
  interviewRecruitment: boolean;
  csatSurvey: boolean;
};

export type RuntimeConfig = {
  backendOrigin: string;
  frontendOrigin: string;
  fxaLoginUrl: string;
  fxaLogoutUrl: string;
  supportUrl: string;
  emailSizeLimitNumber: number;
  emailSizeLimitUnit: string;
  maxFreeAliases: number;
  mozmailDomain: "mozmail.com";
  googleAnalyticsId: `UA-${number}-${number}`;
  maxOnboardingAvailable: number;
  maxOnboardingFreeAvailable: number;
  featureFlags: FeatureFlags;
};

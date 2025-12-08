// Used to provide autocompletion for the config defined in next.config.js.
// See that file for more information on why we use this.
export function getRuntimeConfig(): RuntimeConfig {
  return {
    backendOrigin: process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "",
    frontendOrigin: process.env.NEXT_PUBLIC_FRONTEND_ORIGIN ?? "",
    fxaLoginUrl: process.env.NEXT_PUBLIC_FXA_LOGIN_URL ?? "",
    fxaLogoutUrl: process.env.NEXT_PUBLIC_FXA_LOGOUT_URL ?? "",
    supportUrl: process.env.NEXT_PUBLIC_SUPPORT_URL ?? "",
    emailSizeLimitNumber:
      Number(process.env.NEXT_PUBLIC_EMAIL_SIZE_LIMIT_NUMBER) || 10,
    emailSizeLimitUnit: process.env.NEXT_PUBLIC_EMAIL_SIZE_LIMIT_UNIT ?? "MB",
    maxFreeAliases: Number(process.env.NEXT_PUBLIC_MAX_FREE_ALIASES) || 5,
    mozmailDomain: (process.env.NEXT_PUBLIC_MOZMAIL_DOMAIN ??
      "mozmail.com") as "mozmail.com",
    googleAnalyticsId: (process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ??
      "UA-77033033-33") as `UA-${number}-${number}`,
    maxOnboardingAvailable:
      Number(process.env.NEXT_PUBLIC_MAX_ONBOARDING_AVAILABLE) || 3,
    maxOnboardingFreeAvailable:
      Number(process.env.NEXT_PUBLIC_MAX_ONBOARDING_FREE_AVAILABLE) || 3,
    featureFlags: {
      tips: process.env.NEXT_PUBLIC_FEATURE_TIPS === "true",
      generateCustomAliasMenu:
        process.env.NEXT_PUBLIC_FEATURE_GENERATE_CUSTOM_ALIAS_MENU === "true",
      generateCustomAliasSubdomain:
        process.env.NEXT_PUBLIC_FEATURE_GENERATE_CUSTOM_ALIAS_SUBDOMAIN ===
        "true",
      interviewRecruitment:
        process.env.NEXT_PUBLIC_FEATURE_INTERVIEW_RECRUITMENT === "true",
      csatSurvey: process.env.NEXT_PUBLIC_FEATURE_CSAT_SURVEY === "true",
    },
  };
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

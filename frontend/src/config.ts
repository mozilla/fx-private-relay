import getConfig from "next/config";

// Used to provide autocompletion for the config defined in next.config.js.
// See that file for more information on why we use this.
export function getRuntimeConfig(): RuntimeConfig {
  return getConfig().publicRuntimeConfig;
}

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
  featureFlags: Record<
    | "tips"
    | "generateCustomAliasMenu"
    | "generateCustomAliasSubdomain"
    | "interviewRecruitment"
    | "csatSurvey",
    boolean
  >;
};

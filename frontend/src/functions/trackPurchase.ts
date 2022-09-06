import { event as gaEvent, EventArgs } from "react-ga";
import { setCookie } from "./cookies";

type ArgsWithoutCategory = Omit<EventArgs, "category">;
// Make `action` optional
export type PurchaseTrackingArgs = Partial<ArgsWithoutCategory> &
  Omit<ArgsWithoutCategory, "action">;

/**
 * When the user initiates the Premium purchase flow, this allows us to see whether the purchase gets completed across our different websites.
 *
 * @deprecated Used to track purchases when we just had a single Premium plan.
 */
export const trackPurchaseStart = (args?: PurchaseTrackingArgs) => {
  gaEvent({
    ...args,
    category: "Purchase Button",
    action: args?.action ?? "Engage",
  });
  setCookie("clicked-purchase", "true", { maxAgeInSeconds: 60 * 60 });
};

export type Plan =
  | {
      plan: "premium";
      billing_period: "yearly" | "monthly";
    }
  | {
      plan: "phones";
      billing_period: "yearly" | "monthly";
    }
  | { plan: "bundle" };

export const getCookieId = (plan: Plan): string => {
  if (plan.plan === "premium" || plan.plan === "phones") {
    return `clicked-purchase-${plan.plan}-${plan.billing_period}`;
  }
  if (plan.plan === "bundle") {
    return "clicked-purchase-bundle";
  }
  return null as never;
};

/**
 * When the user initiates a plan-specific purchase flow, this allows us to see whether the purchase gets completed across our different websites.
 */
export const trackPlanPurchaseStart = (
  plan: Plan,
  args?: PurchaseTrackingArgs
) => {
  gaEvent({
    ...args,
    category: getGaCategory(plan),
    action: args?.action ?? "Engage",
  });
  setCookie(getCookieId(plan), "true", { maxAgeInSeconds: 60 * 60 });
};

export const getGaCategory = (plan: Plan): string => {
  if (plan.plan === "premium") {
    return `Purchase ${plan.billing_period} Premium button`;
  }
  if (plan.plan === "phones") {
    return `Purchase ${plan.billing_period} Premium+phones button`;
  }
  if (plan.plan === "bundle") {
    return "Purchase Bundle button";
  }
  return null as never;
};

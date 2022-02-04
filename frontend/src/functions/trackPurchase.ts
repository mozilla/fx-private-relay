import { event as gaEvent, EventArgs } from "react-ga";
import { setCookie } from "./cookies";

type ArgsWithoutCategory = Omit<EventArgs, "category">;
// Make `action` optional
export type PurchaseTrackingArgs = Partial<ArgsWithoutCategory> &
  Omit<ArgsWithoutCategory, "action">;

/**
 * When the user initiates the Premium purchase flow, this allows us to see whether the purchase gets completed across our different websites.
 */
export const trackPurchaseStart = (args?: PurchaseTrackingArgs) => {
  gaEvent({
    ...args,
    category: "Purchase Button",
    action: args?.action ?? "Engage",
  });
  setCookie("clicked-purchase", "true", { maxAgeInSeconds: 60 * 60 });
};

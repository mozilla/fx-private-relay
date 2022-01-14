import { event as gaEvent, EventArgs } from "react-ga";
import { setCookie } from "./cookies";

type ArgsWithoutCategory = Omit<EventArgs, "category">;
// Make `action` optional
export type PurchaseTrackingArgs = Partial<ArgsWithoutCategory> &
  Omit<ArgsWithoutCategory, "action">;

export const trackPurchaseStart = (args?: PurchaseTrackingArgs) => {
  gaEvent({
    ...args,
    category: "Purchase Button",
    action: args?.action ?? "Engage",
  });
  setCookie("clicked-purchase", "true", { maxAgeInSeconds: 60 * 60 });
};

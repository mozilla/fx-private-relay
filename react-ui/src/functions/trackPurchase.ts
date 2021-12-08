import { event as gaEvent, EventArgs } from "react-ga";

type ArgsWithoutCategory = Omit<EventArgs, "category">;
// Make `action` optional
export type PurchaseTrackingArgs = Partial<ArgsWithoutCategory> &
  Omit<ArgsWithoutCategory, "action">;

export const trackPurchaseStart = (args: PurchaseTrackingArgs) => {
  gaEvent({
    ...args,
    category: "Purchase Button",
    action: args.action ?? "Engage",
  });
  document.cookie = "clicked-purchase=true; path=/; samesite=lax; secure";
};

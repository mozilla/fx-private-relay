import { useState } from "react";
import { getCookie, setCookie } from "../functions/cookies";

export type DismissalData = {
  isDismissed: boolean;
  dismiss: () => void;
};

export type DismissalOptions = {
  /** How long the dismissal should last, in seconds. Note that by default, the cookie will be deleted in 30 days. */
  duration?: number;
};

/**
 * This can be used to store a cookie to remember that something was dismissed.
 *
 * @param key Key to identity the item-to-be-dismissed with (i.e. to use in the cookie name). Tip: incorporate the user's ID to make a dismissal user-specific.
 * @param options See {@see DismissalOptions}.
 * @returns Whether the item has been dismissed yet, and a function to call to dismiss the item.
 */
export function useLocalDismissal(
  key: string,
  options: DismissalOptions = {}
): DismissalData {
  const cookieId = key + "_dismissed";
  const dismissalCookieValue = getCookie(cookieId);
  const dismissalTimeStamp = dismissalCookieValue
    ? Number.parseInt(dismissalCookieValue, 10)
    : undefined;

  const wasDismissedBefore =
    // To be dismissed, the cookie has to be set, and either...
    typeof dismissalTimeStamp === "number" &&
    //   ...the dismissal should not be limited in duration, or...
    (typeof options.duration !== "number" ||
      //   ...the dismissal was long enough ago:
      Date.now() - dismissalTimeStamp <= options.duration * 1000);

  const [isDismissed, setIsDismissed] = useState(wasDismissedBefore);

  const dismiss = () => {
    const maxAgeInSeconds =
      typeof options.duration === "number"
        ? options.duration
        : 100 * 365 * 24 * 60 * 60;
    setCookie(cookieId, Date.now().toString(), {
      maxAgeInSeconds: maxAgeInSeconds,
    });
    setIsDismissed(true);
  };

  return {
    isDismissed: isDismissed,
    dismiss: dismiss,
  };
}

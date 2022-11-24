import { useEffect, useState } from "react";
import { getCookie, setCookie } from "../functions/cookies";

export type DismissOptions = {
  /** If true, the dismissal won't take effect right away, but the cookie to store the dismissal _will_ be set. */
  soft?: boolean;
};

export type DismissalData = {
  isDismissed: boolean;
  dismiss: (options?: DismissOptions) => void;
};

export type DismissalOptions = {
  /** How long the dismissal should last, in seconds. Note that by default, the cookie will be deleted in 30 days. */
  duration?: number;
};

/**
 * This can be used to store a cookie to remember that something was dismissed.
 *
 * @param key Key to identity the item-to-be-dismissed with (i.e. to use in the cookie name). Tip: incorporate the user's ID to make a dismissal user-specific.
 * @param options See {@link DismissalOptions}.
 * @returns Whether the item has been dismissed yet, and a function to call to dismiss the item.
 */
export function useLocalDismissal(
  key: string,
  options: DismissalOptions = {}
): DismissalData {
  const cookieId = key + "_dismissed";

  const [isDismissed, setIsDismissed] = useState(
    hasDismissedCookie(cookieId, options.duration)
  );

  // Whenever `key` (and therefore `cookieId`) changes, re-check the appropriate
  // cookie.
  useEffect(() => {
    setIsDismissed(hasDismissedCookie(cookieId, options.duration));
  }, [cookieId, options.duration]);

  const dismiss = (dismissOptions?: DismissOptions) => {
    const maxAgeInSeconds =
      typeof options.duration === "number"
        ? options.duration
        : 100 * 365 * 24 * 60 * 60;
    setCookie(cookieId, Date.now().toString(), {
      maxAgeInSeconds: maxAgeInSeconds,
    });
    if (dismissOptions?.soft !== true) {
      setIsDismissed(true);
    }
  };

  return {
    isDismissed: isDismissed,
    dismiss: dismiss,
  };
}

function hasDismissedCookie(cookieId: string, duration?: number): boolean {
  const dismissalCookieValue = getCookie(cookieId);
  const dismissalTimeStamp = dismissalCookieValue
    ? Number.parseInt(dismissalCookieValue, 10)
    : undefined;

  const wasDismissedBefore =
    // To be dismissed, the cookie has to be set, and either...
    typeof dismissalTimeStamp === "number" &&
    //   ...the dismissal should not be limited in duration, or...
    (typeof duration !== "number" ||
      //   ...the dismissal was long enough ago:
      Date.now() - dismissalTimeStamp <= duration * 1000);

  return wasDismissedBefore;
}

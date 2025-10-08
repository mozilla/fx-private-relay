import { useHasRenderedClientSide } from "./hasRenderedClientSide";

/**
 * Hook to pass UTM parameters on to FxA
 *
 * To learn how people generally subscribe, we need to pass UTM parameters on
 * to FxA. However, since we're pre-rendering the website at build-time, rather
 * than dynamically when a user request comes in, we can't know the values of
 * those parameters yet. And since the first client-side render has to produce
 * the same HTML as the build-time render did (so React can properly attach
 * event handlers and such), we can only add those parameters on the client
 * side *after* that first render happens.
 *
 * This hook provides a function that takes care of that.
 *
 * (The reason it returns a function rather than just taking a URL as a parameter,
 * is that hooks can't run conditionally, and the URL to update might not always be available.)
 *
 * @returns A function that takes a URL, and returns it (with the relevant UTM parameters appended on the client-side).
 */
export function useUtmApplier(): (url: string) => string {
  const hasRenderedClientSide = useHasRenderedClientSide();

  if (!hasRenderedClientSide) {
    return (url) => url;
  }

  return (inputUrl) => {
    const baseUrl = new URL(inputUrl, window.location.origin);
    const inbound = new URLSearchParams(window.location.search);

    const utmParams = new URLSearchParams();
    (
      [
        "utm_source",
        "utm_campaign",
        "utm_medium",
        "utm_content",
        "utm_term",
      ] as const
    ).forEach((k) => {
      const v = inbound.get(k);
      if (v) utmParams.set(k, v);
    });

    if (![...utmParams.keys()].length) {
      return baseUrl.href;
    }

    const encodedUtm = encodeURIComponent(utmParams.toString());
    baseUrl.searchParams.set("auth_params", encodedUtm);

    return baseUrl.href;
  };
}

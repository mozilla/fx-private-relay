import { useCallback, useSyncExternalStore } from "react";

// We used to import these directly from the source of truth (the SCSS),
// but Next.js does not support that with Turbopack:
// https://github.com/vercel/next.js/issues/88544
// Hence, we manually inline the breakpoints from Protocol.
// Since we're not matching Protocol updates, that should be safe enough:
const breakpoints = {
  xs: "(min-width: 320px)",
  sm: "(min-width: 480px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1312px)",
} as const;

function useMediaQueryImp(mediaQuery: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(mediaQuery);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [mediaQuery],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(mediaQuery).matches,
    [mediaQuery],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}

export const useMediaQuery =
  typeof window === "undefined" || typeof window.matchMedia !== "function"
    ? () => false
    : useMediaQueryImp;

/**
 * Get whether the current viewport width matches a Protocol media query.
 *
 * @param width Matches the `$mq-xs` to `$mq-xl` media queries from Protocol.
 * @returns Whether the current viewport width matches that media query.
 */
export function useMinViewportWidth(width: keyof typeof breakpoints): boolean {
  return useMediaQuery(breakpoints[width] ?? "all");
}

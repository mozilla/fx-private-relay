import { useEffect, useState } from "react";
import { MEDIA_QUERIES } from "./mediaQueryConstants";

function useMediaQueryImp(mediaQuery: string): boolean {
  const [mediaQueryList, setMediaQueryList] = useState(
    window.matchMedia(mediaQuery),
  );
  useEffect(() => {
    setMediaQueryList(window.matchMedia(mediaQuery));
  }, [mediaQuery]);

  const [matches, setMatches] = useState(mediaQueryList.matches);
  useEffect(() => {
    const changeListener: Parameters<MediaQueryList["addEventListener"]>[1] = (
      _changedList,
    ) => {
      setMatches(mediaQueryList.matches);
    };
    mediaQueryList.addEventListener("change", changeListener);
    return () => {
      mediaQueryList.removeEventListener("change", changeListener);
    };
  }, [mediaQueryList]);

  return matches;
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
export function useMinViewportWidth(
  width: "xs" | "sm" | "md" | "lg" | "xl",
): boolean {
  return useMediaQuery(MEDIA_QUERIES[width]);
}

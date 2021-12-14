import { useEffect, useState } from "react";

const useMediaQueryImp = (mediaQuery: string): boolean => {
  const [mediaQueryList, setMediaQueryList] = useState(
    window.matchMedia(mediaQuery)
  );
  useEffect(() => {
    setMediaQueryList(window.matchMedia(mediaQuery));
  }, [mediaQuery]);

  const [matches, setMatches] = useState(mediaQueryList.matches);
  useEffect(() => {
    const changeListener: Parameters<MediaQueryList["addEventListener"]>[1] = (
      changedList
    ) => {
      setMatches(mediaQueryList.matches);
    };
    mediaQueryList.addEventListener("change", changeListener);
    return () => {
      mediaQueryList.removeEventListener("change", changeListener);
    };
  }, [mediaQueryList]);

  return matches;
};

export const useMediaQuery =
  typeof window === "undefined" || typeof window.matchMedia !== "function"
    ? () => false
    : useMediaQueryImp;

/**
 * Get whether the current viewport width matches a Protocol media query.
 *
 * Unfortunately we can't just access Sass variables from JavaScript,
 * but by using this hook at least we only need to hardcode the duplicate
 * values in one place.
 *
 * @param width Matches the `$mq-xs` to `$mq-xl` media queries from Protocol.
 * @returns Whether the current viewport width matches that media query.
 */
export const useMinViewportWidth = (
  width: "xs" | "sm" | "md" | "lg" | "xl"
): boolean => {
  let mediaQuery: string = "";
  if (width === "xl") {
    mediaQuery = "(min-width: 1312px)";
  }
  if (width === "lg") {
    mediaQuery = "(min-width: 1024px)";
  }
  if (width === "md") {
    mediaQuery = "(min-width: 768px)";
  }
  if (width === "sm") {
    mediaQuery = "(min-width: 480px)";
  }
  if (width === "xs") {
    mediaQuery = "(min-width: 320px)";
  }
  return useMediaQuery(mediaQuery);
};

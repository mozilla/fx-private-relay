import { useEffect, useState } from "react";
import variables from "./mediaQuery.module.scss";

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
  let mediaQuery = "";
  if (width === "xl") {
    mediaQuery = variables.mq_xl.replace('"', "").replace('"', "");
  }
  if (width === "lg") {
    mediaQuery = variables.mq_lg.replace('"', "").replace('"', "");
  }
  if (width === "md") {
    mediaQuery = variables.mq_md.replace('"', "").replace('"', "");
  }
  if (width === "sm") {
    mediaQuery = variables.mq_sm.replace('"', "").replace('"', "");
  }
  if (width === "xs") {
    mediaQuery = variables.mq_xs.replace('"', "").replace('"', "");
  }
  return useMediaQuery(mediaQuery);
}

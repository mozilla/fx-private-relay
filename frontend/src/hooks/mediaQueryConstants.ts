// Mozilla Protocol media query breakpoints
// These match the $mq-* variables from @mozilla-protocol/core
// See: https://protocol.mozilla.org/fundamentals/grid.html

export const MEDIA_QUERIES = {
  xs: "screen and (min-width: 0)",
  sm: "screen and (min-width: 576px)",
  md: "screen and (min-width: 768px)",
  lg: "screen and (min-width: 992px)",
  xl: "screen and (min-width: 1312px)",
} as const;

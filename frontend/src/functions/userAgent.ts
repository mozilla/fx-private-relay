export function isUsingFirefox() {
  return (
    typeof navigator !== "undefined" &&
    /firefox|FxiOS/i.test(navigator.userAgent)
  );
}

export function supportsFirefoxExtension() {
  return (
    typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent)
  );
}

export function hasDoNotTrackEnabled() {
  return typeof navigator !== "undefined" && navigator.doNotTrack === "1";
}

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

export function supportsChromeExtension() {
  return (
    typeof navigator !== "undefined" &&
    /chrome|chromium/i.test(navigator.userAgent)
  );
}

export function supportsAnExtension() {
  return supportsFirefoxExtension() || supportsChromeExtension();
}

export function hasDoNotTrackEnabled() {
  return typeof navigator !== "undefined" && navigator.doNotTrack === "1";
}

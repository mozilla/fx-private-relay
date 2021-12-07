export function isUsingFirefox() {
  return (
    typeof navigator !== "undefined" &&
    /firefox|FxiOS/i.test(navigator.userAgent)
  );
}

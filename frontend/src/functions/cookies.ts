export function getCookie(cookieId: string): string | undefined {
  if (typeof document === "undefined") {
    // When server-side rendering:
    return undefined;
  }
  const relevantCookieString = document?.cookie
    .split(";")
    .map((cookieString) => cookieString.trim())
    .find((cookieString) => cookieString.startsWith(cookieId + "="));

  const cookieStringParts = relevantCookieString?.split("=");
  const cookieValue =
    Array.isArray(cookieStringParts) && cookieStringParts.length === 2
      ? cookieStringParts[1]
      : undefined;

  return cookieValue;
}

export type SetCookieOptions = {
  /** How many seconds until the browser should delete the cookie. */
  maxAgeInSeconds?: number;
};
export function setCookie(
  cookieId: string,
  value: string,
  options: SetCookieOptions = {},
) {
  const maxAgeString =
    typeof options.maxAgeInSeconds === "number"
      ? `;max-age=${options.maxAgeInSeconds.toString()}`
      : "";

  document.cookie = `${cookieId}=${value}; SameSite=Strict; path=/${maxAgeString}`;
}

export function clearCookie(cookieId: string) {
  setCookie(cookieId, "", { maxAgeInSeconds: 0 });
}

export function getCsrfToken(): string | undefined {
  return getCookie("csrftoken");
}

import ReactGa from "react-ga";

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

export function convertUtmCookieToGaField(
  utmCookie: string,
): ReactGa.FieldsObject {
  /*
   * To preserve utm url param values thru FxA redirects, the server-side
   * middleware:StoreUtmsInCookie stores utm params in cookies with this format:
   * utm_medium=firefox-desktop;
   * utm_source=modal;
   * utm_content=manage-masks-global;
   *
   * analytics.js traffic source field names are in this format:
   * campaignMedium
   * campaignSource
   * campaignContent
   *
   * So, convert the cookie names and values to GA field names & values
   */
  const campaignField = utmCookie.split("=");
  const campaignFieldName = campaignField[0].replace("utm_", "");
  const capitalizedCampaignFieldName =
    campaignFieldName.charAt(0).toUpperCase() + campaignFieldName.slice(1);
  const campaignFieldValue = campaignField[1];
  const gaField: ReactGa.FieldsObject = {};
  const gaFieldName = `campaign${capitalizedCampaignFieldName}`;
  gaField[gaFieldName] = campaignFieldValue;
  return gaField;
}

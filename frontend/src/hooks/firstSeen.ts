import { getCookie, setCookie } from "../functions/cookies";
import { useProfiles } from "./api/profile";
import { useIsLoggedIn } from "./session";

/**
 * Keep track of when the logged-in user first encountered a page *with this hook*
 *
 * If a component using this hook is first rendered and the user is logged in,
 * a cookie is set storing the current date and time. The hook will then keep
 * returning that date and time for the current user.
 *
 * @returns Date and time when the current user was first seen.
 */
export function useFirstSeen(): Date | null {
  const isLoggedIn = useIsLoggedIn();
  const profileData = useProfiles();

  if (!isLoggedIn || !profileData.data?.[0].id) {
    return null;
  }

  const firstSeenString = getCookie("first_seen_" + profileData.data[0].id);
  if (typeof firstSeenString === "string") {
    return new Date(Number.parseInt(firstSeenString, 10));
  }

  const currentTimestamp = Date.now();
  setCookie(
    "first_seen_" + profileData.data[0].id,
    currentTimestamp.toString(),
    {
      maxAgeInSeconds: 10 * 365 * 24 * 60 * 60,
    },
  );
  return new Date(currentTimestamp);
}

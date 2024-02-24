import { useProfiles } from "./api/profile";

export type LoggedInState = "logged-out" | "logged-in" | "unknown";

/*
 * Is the user logged in?
 * @returns LoggedInState, 'unknown' if loading profiles, 'logged-in' or 'logged-out' once known
 */
export function useIsLoggedIn(): LoggedInState {
  const profileData = useProfiles();
  const checking =
    typeof profileData === "undefined" ||
    (typeof profileData.data === "undefined" &&
      typeof profileData.error === "undefined");
  if (checking) {
    return "unknown";
  }
  return typeof profileData !== "undefined" &&
    typeof profileData.data !== "undefined" &&
    typeof profileData.error === "undefined"
    ? "logged-in"
    : "logged-out";
}

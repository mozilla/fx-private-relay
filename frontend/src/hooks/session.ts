import { useProfiles } from "./api/profile";

export function useIsLoggedIn(): boolean {
  const profileData = useProfiles();
  const isLoggedIn =
    typeof profileData.data !== "undefined" &&
    typeof profileData.error === "undefined";

  return isLoggedIn;
}

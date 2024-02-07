import { useIsLoggedIn } from "./session";
import { useProfiles } from "./api/profile";

/**
 * Returns True if metrics should be enabled
 */
export function useMetrics() {
  const profileData = useProfiles();
  const isLoggedIn = useIsLoggedIn();
  const metricsEnabled = !isLoggedIn || profileData?.data?.[0].metrics_enabled;
  return metricsEnabled;
}

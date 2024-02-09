import { useIsLoggedIn } from "./session";
import { useProfiles } from "./api/profile";

export type MetricsState = "enabled" | "disabled" | "unknown";

/**
 * Should metrics be emitted?
 * @returns MetricsState, 'unknown' if loading profile, 'enabled' or 'disabled' after loading
 */
export function useMetrics(): MetricsState {
  const isLoggedIn = useIsLoggedIn();
  const profileData = useProfiles();
  if (isLoggedIn === "unknown") {
    return "unknown";
  }
  const metricsEnabled =
    isLoggedIn === "logged-out" ||
    profileData?.data?.[0].metrics_enabled === true;
  return metricsEnabled ? "enabled" : "disabled";
}

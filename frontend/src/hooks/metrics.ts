import { useIsLoggedIn } from "./session";
import { useProfiles } from "./api/profile";
import { hasDoNotTrackEnabled } from "../functions/userAgent";

export type MetricsState = "enabled" | "disabled" | "unknown";

/**
 * Should metrics be emitted?
 * @returns MetricsState, 'unknown' if loading profile, 'enabled' or 'disabled' after loading
 */
export function useMetrics(): MetricsState {
  const isLoggedIn = useIsLoggedIn();
  const profileData = useProfiles();
  const dnt = hasDoNotTrackEnabled();
  if (dnt) {
    return "disabled";
  }
  if (isLoggedIn === "unknown") {
    return "unknown";
  }
  const anonVisitor = isLoggedIn === "logged-out";
  const profileMetricsEnabled = profileData?.data?.[0].metrics_enabled === true;
  const metricsEnabled = anonVisitor || profileMetricsEnabled;
  return metricsEnabled ? "enabled" : "disabled";
}

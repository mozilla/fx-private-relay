import { SWRResponse } from "swr";
import { useApiV1 } from "./api";
import { RuntimeData } from "./types";
import { DEFAULT_RUNTIME_DATA } from "./runtimeData-default";

/**
 * Fetch data from the back-end that wasn't known at build time (e.g. the user's country, or environment variables) using [SWR](https://swr.vercel.app).
 * Falls back to default runtime data values when API data is unavailable.
 */
export function useRuntimeData() {
  const runtimeData: SWRResponse<RuntimeData, unknown> = useApiV1(
    "/runtime_data",
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const isClient = typeof window !== "undefined";
  // Return SWR response, but override the `data` with defaults if missing
  return {
    ...runtimeData,
    data: runtimeData.data ?? (isClient ? DEFAULT_RUNTIME_DATA : undefined),
  };
}

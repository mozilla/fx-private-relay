import { FlagNames, RuntimeData } from "../hooks/api/runtimeData";

export type RuntimeDataWithWaffle = RuntimeData & {
  WAFFLE_FLAGS: RuntimeData["WAFFLE_FLAGS"];
};

export function isFlagActive(
  runtimeData: RuntimeData | undefined,
  flagName: FlagNames
): runtimeData is RuntimeDataWithWaffle {
  if (runtimeData?.WAFFLE_FLAGS) {
    for (const flag of runtimeData.WAFFLE_FLAGS) {
      if (flag[0] === flagName && flag[1] === true) {
        return true;
      }
    }
  }
  return false;
}

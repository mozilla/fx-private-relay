import { useState } from "react";
import { useAddonData } from "./addon";
import { AliasData, isRandomAlias } from "./api/aliases";

export type LocalLabel = {
  /** `type` is to allow for a transition period while people migrate to a new add-on version that uses `mask_type` */
  type: "random" | "custom";
  mask_type: "random" | "custom";
  id: number;
  description: string;
  generated_for?: string;
};
export type SetLocalLabel = (alias: AliasData, newLabel: string) => void;
export type LocalLabelHook = [LocalLabel[], SetLocalLabel];
export type NotEnabled = [null, SetLocalLabel];

/**
 * Read and update the local label for an alias.
 *
 * This hook takes care of the following requirements for local labels:
 * - They are only available when the add-on is installed.
 * - Labels are obtained from the add-on.
 * - Updated labels are sent to the add-on.
 *
 * @param alias The alias to get the locally stored label for.
 * @returns The locally stored label, if any, and a function to update it.
 */
export function useLocalLabels(): LocalLabelHook | NotEnabled {
  const addonData = useAddonData();
  const [localLabels, setLocalLabels] = useState<LocalLabel[]>(
    addonData.localLabels ?? []
  );

  if (addonData.present !== true) {
    return [null, () => undefined];
  }

  const updateLabel: SetLocalLabel = (alias, newLabel) => {
    const maskType = isRandomAlias(alias) ? "random" : "custom";

    // Replace existing labels for this alias:
    const oldLocalLabel = localLabels.find(
      (localLabel) =>
        localLabel.id === alias.id &&
        (localLabel.mask_type === maskType ||
          (typeof localLabel.mask_type === "undefined" &&
            localLabel.type === maskType))
    );
    const newLocalLabels = localLabels.filter(
      (localLabel) => localLabel !== oldLocalLabel
    );

    newLocalLabels.push({
      id: alias.id,
      type: maskType,
      mask_type: maskType,
      description: newLabel,
      generated_for: oldLocalLabel?.generated_for,
    });
    addonData.sendEvent("labelUpdate", {
      type: maskType,
      mask_type: maskType,
      alias: alias,
      newLabel: newLabel,
    });
    setLocalLabels(newLocalLabels);
  };

  return [localLabels, updateLabel];
}

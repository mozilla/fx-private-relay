import { useAddonData } from "./addon";
import { AliasData, isRandomAlias } from "./api/aliases";
import { useProfiles } from "./api/profile";

export type LocalLabel = {
  type: "random" | "custom";
  id: number;
  description: string;
};
export type SetLocalLabel = (alias: AliasData, newLabel: string) => void;
export type LocalLabelHook = [LocalLabel[], SetLocalLabel];
export type NotEnabled = [null, SetLocalLabel];

/**
 * Read and update the local label for an alias.
 *
 * This hook takes care of the following requirements for local labels:
 * - They are only available when the add-on is installed. (Mostly for
 *   backwards compatibility with the time when the add-on would store
 *   the labels in its extension storage, but also because it's a signal
 *   that the current user is the only user of this browser).
 * - If no labels are stored locally yet, and the add-on does provide a
 *   set of labels that *it* has stored, then those are copied into
 *   localStorage and then used.
 * - Updating a single alias's label does not overwrite the locally-
 *   stored labels of other aliases.
 *
 * @param alias The alias to get the locally stored label for.
 * @returns The locally stored label, if any, and a function to update it.
 */
export function useLocalLabels(): LocalLabelHook | NotEnabled {
  const addonData = useAddonData();
  const profileData = useProfiles();

  if (addonData.present !== true) {
    return [null, () => undefined];
  }

  const profileId = profileData.data?.[0].id ?? "";
  const storageKey = `localLabels_${profileId}`;

  const getExistingLabels = (): LocalLabel[] => {
    const existingLocalLabelsString = localStorage.getItem(storageKey);
    const existingLocalLabels: LocalLabel[] =
      existingLocalLabelsString !== null
        ? JSON.parse(existingLocalLabelsString)
        : addonData.localLabels ?? [];

    if (existingLocalLabelsString === null) {
      // If the add-on has provided labels and none are stored in localStorage yet,
      // import the add-on's labels into localStorage:
      localStorage.setItem(storageKey, JSON.stringify(existingLocalLabels));
    }

    return existingLocalLabels;
  };

  const updateLabel: SetLocalLabel = (alias, newLabel) => {
    const type = isRandomAlias(alias) ? "random" : "custom";
    // Refresh existing labels so as not to overwrite labels of other aliases
    // that have changed since last retrieving them:
    const existingLocalLabels = getExistingLabels();

    // Replace existing labels for this alias:
    const newLocalLabels = existingLocalLabels.filter(
      (localLabel) => localLabel.id !== alias.id || localLabel.type !== type
    );
    newLocalLabels.push({
      id: alias.id,
      type: type,
      description: newLabel,
    });
    localStorage.setItem(storageKey, JSON.stringify(newLocalLabels));
  };

  const existingLocalLabels = getExistingLabels();

  return [existingLocalLabels, updateLabel];
}

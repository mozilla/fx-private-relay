import { Localized, useLocalization } from "@fluent/react";
import { useState } from "react";
import { VisuallyHidden } from "react-aria";
import styles from "./AliasList.module.scss";
import arrowDownIcon from "../../../../../static/images/arrowhead.svg";
import { AliasData, isRandomAlias } from "../../../hooks/api/aliases";
import { ProfileData } from "../../../hooks/api/profile";
import { Alias } from "./Alias";
import { filterAliases } from "../../../functions/filterAliases";
import { CategoryFilter, SelectedFilters } from "./CategoryFilter";
import { UserData } from "../../../hooks/api/user";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import { useLocalLabels } from "../../../hooks/localLabels";
import { AliasGenerationButton } from "./AliasGenerationButton";
import { parseDate } from "../../../functions/parseDate";

export type Props = {
  aliases: AliasData[];
  profile: ProfileData;
  user: UserData;
  runtimeData?: RuntimeData;
  onCreate: (
    options: { type: "random" } | { type: "custom"; address: string }
  ) => void;
  onUpdate: (alias: AliasData, updatedFields: Partial<AliasData>) => void;
  onDelete: (alias: AliasData) => void;
};

/**
 * Display a list of <Alias> cards, with the ability to filter them or create a new alias.
 */
export const AliasList = (props: Props) => {
  const { l10n } = useLocalization();
  const [stringFilterInput, setStringFilterInput] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<SelectedFilters>({});
  const [localLabels, storeLocalLabel] = useLocalLabels();
  const [showStale, setShowStale] = useState(false);

  if (props.aliases.length === 0) {
    return null;
  }

  const aliases = sortAliases(
    filterAliases(props.aliases, props.profile, {
      ...categoryFilters,
      string: stringFilterInput,
    })
  );
  const [staleAliases, activeAliases] = splitArray(aliases, isStale);

  const aliasToCard = (alias: AliasData, index: number) => {
    const aliasWithLocalLabel = { ...alias };
    if (
      alias.description.length === 0 &&
      props.profile.server_storage === false &&
      localLabels !== null
    ) {
      const type = isRandomAlias(alias) ? "random" : "custom";
      const localLabel = localLabels.find(
        (localLabel) => localLabel.id === alias.id && localLabel.type === type
      );
      if (localLabel !== undefined) {
        aliasWithLocalLabel.description = localLabel.description;
      }
    }

    const onUpdate = (updatedFields: Partial<AliasData>) => {
      if (
        localLabels !== null &&
        typeof updatedFields.description === "string"
      ) {
        storeLocalLabel(alias, updatedFields.description);
      }
      return props.onUpdate(alias, updatedFields);
    };

    return (
      <li
        className={styles["alias-card-wrapper"]}
        key={alias.address + isRandomAlias(alias)}
      >
        <Alias
          alias={aliasWithLocalLabel}
          user={props.user}
          profile={props.profile}
          onUpdate={onUpdate}
          onDelete={() => props.onDelete(alias)}
          defaultOpen={index === 0}
          showLabelEditor={props.profile.server_storage || localLabels !== null}
        />
      </li>
    );
  };
  const activeAliasCards = activeAliases.map(aliasToCard);
  const staleAliasCards = staleAliases.map(aliasToCard);

  // With at most five aliases, filters aren't really useful
  // for non-Premium users.
  const filters = props.profile.has_premium ? (
    <>
      <div className={styles["string-filter"]}>
        <VisuallyHidden>
          <label htmlFor="stringFilter">
            {l10n.getString("profile-filter-search-placeholder")}
          </label>
        </VisuallyHidden>
        <input
          value={stringFilterInput}
          onChange={(e) => setStringFilterInput(e.target.value)}
          type="search"
          name="stringFilter"
          id="stringFilter"
          placeholder={l10n.getString("profile-filter-search-placeholder")}
        />
        <span className={styles["match-count"]}>
          {aliases.length}/{props.aliases.length}
        </span>
      </div>
      <div className={styles["category-filter"]}>
        <CategoryFilter
          onChange={setCategoryFilters}
          selectedFilters={categoryFilters}
        />
      </div>
    </>
  ) : null;

  const emptyStateMessage =
    props.aliases.length > 0 && aliases.length === 0 ? (
      <Localized
        id="profile-filter-no-results"
        elems={{
          "clear-button": (
            <button
              onClick={() => {
                setCategoryFilters({});
                setStringFilterInput("");
              }}
              className={styles["clear-filters-button"]}
            />
          ),
        }}
      >
        <p className={styles["empty-state-message"]} />
      </Localized>
    ) : null;

  const staleSection =
    staleAliases.length === 0 ? null : (
      <div
        className={`${styles["stale-wrapper"]} ${
          showStale ? styles["is-expanded"] : styles["is-collapsed"]
        }`}
      >
        <button
          onClick={() => setShowStale(!showStale)}
          className={styles["stale-toggle-button"]}
          title={l10n.getString("profile-stale-button-tooltip", { days: 30 })}
        >
          <span>
            <img src={arrowDownIcon.src} alt="" />
            {l10n.getString(
              showStale
                ? "profile-stale-button-active"
                : "profile-stale-button-inactive",
              {
                count: staleAliases.length,
              }
            )}
          </span>
        </button>
        <ul className={styles["stale-aliases"]}>{staleAliasCards}</ul>
      </div>
    );

  return (
    <section>
      <div className={styles.controls}>
        {filters}
        <div className={styles["new-alias-button"]}>
          <AliasGenerationButton
            aliases={props.aliases}
            profile={props.profile}
            runtimeData={props.runtimeData}
            onCreate={props.onCreate}
          />
        </div>
      </div>
      <ul>{activeAliasCards}</ul>
      {staleSection}
      {emptyStateMessage}
    </section>
  );
};

function sortAliases(aliases: AliasData[]): AliasData[] {
  const aliasDataCopy = aliases.slice();
  aliasDataCopy.sort((aliasA, aliasB) => {
    // `Date.parse` can be inconsistent,
    // but should be fairly reliable in parsing ISO 8601 strings
    // (though if Temporal ever gets accepted by TC39, we should switch to that):
    const aliasATimestamp = Date.parse(aliasA.created_at);
    const aliasBTimestamp = Date.parse(aliasB.created_at);
    return aliasBTimestamp - aliasATimestamp;
  });
  return aliasDataCopy;
}

/**
 * Returns true if an alias hasn't been used nor modified in the last 30 days.
 */
function isStale(alias: AliasData): boolean {
  const lastModifiedUnixTime = parseDate(alias.last_modified_at).getTime();
  const now = Date.now();
  const staleAge = 30 * 24 * 60 * 60 * 1000;
  if (alias.last_used_at === null) {
    return now - lastModifiedUnixTime > staleAge;
  }
  const lastUsedUnixTime = parseDate(alias.last_used_at).getTime();
  return (
    now - lastUsedUnixTime > staleAge && now - lastModifiedUnixTime > staleAge
  );
}

function splitArray<T>(
  array: T[],
  predicate: (item: T) => boolean
): [T[], T[]] {
  return array.reduce(
    ([matchingEntries, nonMatchingEntries], entry) => {
      if (predicate(entry)) {
        matchingEntries.push(entry);
      } else {
        nonMatchingEntries.push(entry);
      }
      return [matchingEntries, nonMatchingEntries];
    },
    [[], []] as [T[], T[]]
  );
}

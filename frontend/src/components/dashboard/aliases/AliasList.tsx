import { Localized, useLocalization } from "@fluent/react";
import { useState } from "react";
import { VisuallyHidden } from "react-aria";
import styles from "./AliasList.module.scss";
import { AliasData, isRandomAlias } from "../../../hooks/api/aliases";
import { ProfileData } from "../../../hooks/api/profile";
import { Alias } from "./Alias";
import { filterAliases } from "../../../functions/filterAliases";
import { CategoryFilter, SelectedFilters } from "./CategoryFilter";
import { UserData } from "../../../hooks/api/user";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import { useLocalLabels } from "../../../hooks/localLabels";
import { AliasGenerationButton } from "./AliasGenerationButton";
import searchIcon from "../../../../../static/images/icon-search-blue.svg";

export type Props = {
  aliases: AliasData[];
  profile: ProfileData;
  user: UserData;
  runtimeData?: RuntimeData;
  onCreate: (
    options:
      | { mask_type: "random" }
      | { mask_type: "custom"; address: string; blockPromotionals: boolean }
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
  const [stringFilterVisible, setStringFilterVisible] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState<SelectedFilters>({});
  const [localLabels, storeLocalLabel] = useLocalLabels();
  // Whenever a new alias is created, this value tracks the aliases that existed
  // before that. That allows us to expand newly-created aliases by default.
  const [existingAliases, setExistingAliases] = useState(props.aliases);

  if (props.aliases.length === 0) {
    return null;
  }

  const aliasesWithLocalLabels = props.aliases.map((alias) => {
    const aliasWithLocalLabel = { ...alias };
    if (
      alias.description.length === 0 &&
      props.profile.server_storage === false &&
      localLabels !== null
    ) {
      const localLabel = localLabels.find(
        (localLabel) =>
          localLabel.id === alias.id && localLabel.mask_type === alias.mask_type
      );
      if (localLabel !== undefined) {
        aliasWithLocalLabel.description = localLabel.description;
      }
    }
    return aliasWithLocalLabel;
  });

  const aliases = sortAliases(
    filterAliases(aliasesWithLocalLabels, {
      ...categoryFilters,
      string: stringFilterInput,
    })
  );

  const aliasCards = aliases.map((alias) => {
    const onUpdate = (updatedFields: Partial<AliasData>) => {
      if (
        localLabels !== null &&
        typeof updatedFields.description === "string" &&
        props.profile.server_storage === false
      ) {
        storeLocalLabel(alias, updatedFields.description);
        delete updatedFields.description;
      }
      return props.onUpdate(alias, updatedFields);
    };

    const isExistingAlias = existingAliases.some(
      (existingAlias) => existingAlias.id === alias.id
    );

    return (
      <li
        className={styles["alias-card-wrapper"]}
        key={alias.address + isRandomAlias(alias)}
      >
        <Alias
          alias={alias}
          user={props.user}
          profile={props.profile}
          onUpdate={onUpdate}
          onDelete={() => props.onDelete(alias)}
          defaultOpen={!isExistingAlias}
          showLabelEditor={props.profile.server_storage || localLabels !== null}
          runtimeData={props.runtimeData}
        />
      </li>
    );
  });

  // With at most five aliases, filters aren't really useful
  // for non-Premium users.
  const categoryFilter = props.profile.has_premium ? (
    <div className={styles["category-filter"]}>
      <CategoryFilter
        onChange={setCategoryFilters}
        selectedFilters={categoryFilters}
      />
    </div>
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

  const onCreate: typeof props.onCreate = (options) => {
    setExistingAliases(props.aliases);

    return props.onCreate(options);
  };

  return (
    <section>
      <div className={styles.controls}>
        <div
          className={`${styles["string-filter"]} ${
            stringFilterVisible ? styles["is-visible"] : ""
          }`}
        >
          <VisuallyHidden>
            <label htmlFor="stringFilter">
              {l10n.getString("profile-filter-search-placeholder-2")}
            </label>
          </VisuallyHidden>
          <input
            value={stringFilterInput}
            onChange={(e) => setStringFilterInput(e.target.value)}
            type="search"
            name="stringFilter"
            id="stringFilter"
            placeholder={l10n.getString("profile-filter-search-placeholder-2")}
          />
          <span className={styles["match-count"]}>
            {aliases.length}/{props.aliases.length}
          </span>
        </div>
        <button
          onClick={() => setStringFilterVisible(!stringFilterVisible)}
          title={l10n.getString("profile-filter-search-placeholder-2")}
          className={styles["string-filter-toggle"]}
        >
          <img
            src={searchIcon.src}
            alt={l10n.getString("profile-filter-search-placeholder-2")}
            width={20}
            height={20}
          />
        </button>
        {categoryFilter}
        <div className={styles["new-alias-button"]}>
          <AliasGenerationButton
            aliases={props.aliases}
            profile={props.profile}
            runtimeData={props.runtimeData}
            onCreate={onCreate}
          />
        </div>
      </div>
      <ul>{aliasCards}</ul>
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

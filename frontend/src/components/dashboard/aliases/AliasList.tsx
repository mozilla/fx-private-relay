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

  if (props.aliases.length === 0) {
    return null;
  }

  const aliases = sortAliases(
    filterAliases(props.aliases, props.profile, {
      ...categoryFilters,
      string: stringFilterInput,
    })
  );

  const aliasCards = aliases.map((alias, index) => {
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
        className={styles.aliasCardWrapper}
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
  });

  // With at most five aliases, filters aren't really useful
  // for non-Premium users.
  const filters = props.profile.has_premium ? (
    <>
      <div className={styles.stringFilter}>
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
        <span className={styles.matchCount}>
          {aliases.length}/{props.aliases.length}
        </span>
      </div>
      <div className={styles.categoryFilter}>
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
              className={styles.clearFiltersButton}
            />
          ),
        }}
      >
        <p className={styles.emptyStateMessage} />
      </Localized>
    ) : null;

  return (
    <section>
      <div className={styles.controls}>
        {filters}
        <div className={styles.newAliasButton}>
          <AliasGenerationButton
            aliases={props.aliases}
            profile={props.profile}
            runtimeData={props.runtimeData}
            onCreate={props.onCreate}
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

import { useLocalization } from "@fluent/react";
import styles from "./AliasList.module.scss";
import plusIcon from "../../../../static/images/plus-sign-white.svg";
import { AliasData, isRandomAlias } from "../../hooks/api/aliases";
import { ProfileData } from "../../hooks/api/profile";
import { Alias } from "./Alias";
import { Button } from "../Button";
import { useState } from "react";
import { filterAliases } from "../../functions/filterAliases";
import { CategoryFilter, SelectedFilters } from "./CategoryFilter";

export type Props = {
  aliases: AliasData[];
  profile: ProfileData;
  onCreate: () => void;
  onUpdate: (alias: AliasData, updatedFields: Partial<AliasData>) => void;
};

export const AliasList = (props: Props) => {
  const { l10n } = useLocalization();
  const [stringFilterInput, setStringFilterInput] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<SelectedFilters>({});
  const aliases = sortAliases(
    filterAliases(props.aliases, props.profile, {
      ...categoryFilters,
      string: stringFilterInput,
    })
  );

  const aliasCards = aliases.map((alias) => (
    <li
      className={styles.aliasCardWrapper}
      key={alias.address + isRandomAlias(alias)}
    >
      <Alias
        alias={alias}
        profile={props.profile}
        onUpdate={(updatedFields) => props.onUpdate(alias, updatedFields)}
      />
    </li>
  ));

  const maxAliases = Number.parseInt(
    process.env.NEXT_PUBLIC_MAX_NUM_FREE_ALIASES!,
    10
  );
  const newAliasButton =
    props.profile.has_premium || aliases.length < maxAliases ? (
      <Button onClick={props.onCreate}>
        <img src={plusIcon.src} alt="" width={16} height={16} />
        {l10n.getString("profile-label-generate-new-alias")}
      </Button>
    ) : // TODO: Add "Get unlimited aliases" button:
    null;

  // With at most five aliases, filters aren't really useful
  // for non-Premium users.
  const filters = props.profile.has_premium ? (
    <>
      <div className={styles.stringFilter}>
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

  return (
    <>
      <div className={styles.controls}>
        {filters}
        <div className={styles.newAliasButton}>{newAliasButton}</div>
      </div>
      <ul>{aliasCards}</ul>
    </>
  );
};

function sortAliases(aliases: AliasData[]): AliasData[] {
  const aliasDataCopy = aliases.slice();
  aliasDataCopy.sort((aliasA, aliasB) => {
    // `Date.parse` can be inconsistent,
    // but should be fairly reliable in parsing ISO 8601 strings:
    const aliasATimestamp = Date.parse(aliasA.created_at);
    const aliasBTimestamp = Date.parse(aliasB.created_at);
    return aliasBTimestamp - aliasATimestamp;
  });
  return aliasDataCopy;
}

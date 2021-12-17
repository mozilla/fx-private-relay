import { useLocalization } from "@fluent/react";
import styles from "./AliasList.module.scss";
import plusIcon from "../../../../../static/images/plus-sign-white.svg";
import { AliasData, isRandomAlias } from "../../../hooks/api/aliases";
import { ProfileData } from "../../../hooks/api/profile";
import { Alias } from "./Alias";
import { Button, LinkButton } from "../../Button";
import { useState } from "react";
import { filterAliases } from "../../../functions/filterAliases";
import { CategoryFilter, SelectedFilters } from "./CategoryFilter";
import { UserData } from "../../../hooks/api/user";
import {
  getPremiumSubscribeLink,
  isPremiumAvailableInCountry,
} from "../../../functions/getPlan";
import { PremiumCountriesData } from "../../../hooks/api/premiumCountries";
import { useGaPing } from "../../../hooks/gaPing";
import { trackPurchaseStart } from "../../../functions/trackPurchase";

export type Props = {
  aliases: AliasData[];
  profile: ProfileData;
  user: UserData;
  premiumCountries?: PremiumCountriesData;
  onCreate: () => void;
  onUpdate: (alias: AliasData, updatedFields: Partial<AliasData>) => void;
  onDelete: (alias: AliasData) => void;
};

export const AliasList = (props: Props) => {
  const { l10n } = useLocalization();
  const [stringFilterInput, setStringFilterInput] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<SelectedFilters>({});
  const getUnlimitedButtonRef = useGaPing({
    category: "Purchase Button",
    label: "profile-create-alias-upgrade-promo",
  });

  if (props.aliases.length === 0) {
    return null;
  }

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
        user={props.user}
        profile={props.profile}
        onUpdate={(updatedFields) => props.onUpdate(alias, updatedFields)}
        onDelete={() => props.onDelete(alias)}
      />
    </li>
  ));

  const premiumSubscribeButton = isPremiumAvailableInCountry(
    props.premiumCountries
  ) ? (
    <LinkButton
      href={getPremiumSubscribeLink(props.premiumCountries)}
      target="_blank"
      rel="noopener noreferrer"
      ref={getUnlimitedButtonRef}
      onClick={() =>
        trackPurchaseStart({ label: "profile-create-alias-upgrade-promo" })
      }
    >
      {l10n.getString("profile-label-upgrade")}
    </LinkButton>
  ) : (
    <Button disabled>
      <img src={plusIcon.src} alt="" width={16} height={16} />
      {l10n.getString("profile-label-generate-new-alias")}
    </Button>
  );
  const maxAliases = Number.parseInt(
    process.env.NEXT_PUBLIC_MAX_NUM_FREE_ALIASES as string,
    10
  );
  const newAliasButton =
    props.profile.has_premium || aliases.length < maxAliases ? (
      <Button
        onClick={props.onCreate}
        title={l10n.getString("profile-label-generate-new-alias")}
      >
        <img src={plusIcon.src} alt="" width={16} height={16} />
        {l10n.getString("profile-label-generate-new-alias")}
      </Button>
    ) : (
      premiumSubscribeButton
    );

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
    <section>
      <div className={styles.controls}>
        {filters}
        <div className={styles.newAliasButton}>{newAliasButton}</div>
      </div>
      <ul>{aliasCards}</ul>
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

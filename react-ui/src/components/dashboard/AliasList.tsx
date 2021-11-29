import { useLocalization } from "@fluent/react";
import styles from "./AliasList.module.scss";
import plusIcon from "../../../../static/images/plus-sign-white.svg";
import { AliasData, isRandomAlias } from "../../hooks/api/aliases";
import { ProfileData } from "../../hooks/api/profile";
import { Alias } from "./Alias";
import { Button } from "../Button";

export type Props = {
  aliases: AliasData[];
  profile: ProfileData;
  onCreate: () => void;
  onUpdate: (alias: AliasData, updatedFields: Partial<AliasData>) => void;
};

export const AliasList = (props: Props) => {
  const { l10n } = useLocalization();
  const aliases = sortAliases(props.aliases);

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

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.stringFilter}></div>
        {newAliasButton}
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

import styles from "./AliasList.module.scss";
import { AliasData, isRandomAlias } from "../../hooks/api/aliases";
import { ProfileData } from "../../hooks/api/profile";
import { Alias } from "./Alias";

export type Props = {
  aliases: AliasData[];
  profile: ProfileData;
  onUpdate: (alias: AliasData, updatedFields: Partial<AliasData>) => void;
};

export const AliasList = (props: Props) => {
  const aliasCards = props.aliases.map((alias) => (
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

  return (
    <>
      <ul>{aliasCards}</ul>
    </>
  );
};

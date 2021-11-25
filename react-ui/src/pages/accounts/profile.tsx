import { useLocalization } from "@fluent/react";
import type { NextPage } from "next";
import styles from "./profile.module.scss";
import { Layout } from "../../components/layout/Layout";
import { useProfiles } from "../../hooks/api/profile";
import {
  AliasData,
  getAllAliases,
  isRandomAlias,
  useAliases,
} from "../../hooks/api/aliases";
import { Alias } from "../../components/dashboard/Alias";

const Profile: NextPage = () => {
  const profileData = useProfiles();
  const { randomAliasData, customAliasData } = useAliases();
  const { l10n } = useLocalization();

  const profile = profileData.data?.[0];
  if (!profile || !randomAliasData.data || !customAliasData.data) {
    // TODO: Show a loading spinner?
    // TODO: Redirect the user to the login page if they're not logged in?
    return null;
  }

  const toggleAlias = (alias: AliasData, enable: boolean) => {
    if (isRandomAlias(alias)) {
      randomAliasData.update({ id: alias.id, enabled: enable });
    } else {
      customAliasData.update({ id: alias.id, enabled: enable });
    }
  };

  const allAliases = getAllAliases(randomAliasData.data, customAliasData.data);
  const aliasCards = allAliases.map((alias) => (
    <Alias
      key={alias.address + isRandomAlias(alias)}
      alias={alias}
      profile={profile}
      onToggle={(enabled) => toggleAlias(alias, enabled)}
    />
  ));

  return (
    <>
      <Layout>
        <main className={styles.mainWrapper}>{aliasCards}</main>
      </Layout>
    </>
  );
};

export default Profile;

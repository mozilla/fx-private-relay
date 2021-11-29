import { Localized, useLocalization } from "@fluent/react";
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
import { useUsers } from "../../hooks/api/user";
import { AliasList } from "../../components/dashboard/AliasList";

const Profile: NextPage = () => {
  const profileData = useProfiles();
  const userData = useUsers();
  const { randomAliasData, customAliasData } = useAliases();
  const { l10n } = useLocalization();

  const profile = profileData.data?.[0];
  const user = userData.data?.[0];
  if (!profile || !user || !randomAliasData.data || !customAliasData.data) {
    // TODO: Show a loading spinner?
    // TODO: Redirect the user to the login page if they're not logged in?
    return null;
  }

  const updateAlias = (alias: AliasData, updatedFields: Partial<AliasData>) => {
    if (isRandomAlias(alias)) {
      randomAliasData.update({ ...updatedFields, id: alias.id });
    } else {
      customAliasData.update({ ...updatedFields, id: alias.id });
    }
  };

  const allAliases = getAllAliases(randomAliasData.data, customAliasData.data);

  const totalBlockedEmails = allAliases.reduce(
    (count, alias) => count + alias.num_blocked,
    0
  );
  const totalForwardedEmails = allAliases.reduce(
    (count, alias) => count + alias.num_forwarded,
    0
  );

  return (
    <>
      <Layout>
        <header className={styles.header}>
          <div className={styles.headerWrapper}>
            <Localized
              id="profile-label-welcome-html"
              vars={{
                email: user.email,
              }}
              elems={{
                span: <span className={styles.lead} />,
              }}
            >
              <span className={styles.greeting} />
            </Localized>
            <div className={styles.accountStats}>
              <span className={styles.stat}>
                <span className={styles.label}>
                  {l10n.getString("profile-stat-label-aliases-used")}
                </span>
                <span className={styles.value}>{allAliases.length}</span>
              </span>
              <span className={styles.stat}>
                <span className={styles.label}>
                  {l10n.getString("profile-stat-label-blocked")}
                </span>
                <span className={styles.value}>{totalBlockedEmails}</span>
              </span>
              <span className={styles.stat}>
                <span className={styles.label}>
                  {l10n.getString("profile-stat-label-forwarded")}
                </span>
                <span className={styles.value}>{totalForwardedEmails}</span>
              </span>
            </div>
          </div>
        </header>
        <main className={styles.mainWrapper}>
          <AliasList
            aliases={allAliases}
            onUpdate={updateAlias}
            profile={profile}
          />
        </main>
      </Layout>
    </>
  );
};

export default Profile;

import { useLocalization } from "@fluent/react";
import type { NextPage } from "next";
import { FormEventHandler } from "react";
import styles from "./setting.module.scss";
import { Layout } from "../components/Layout";
import { Banner } from "../components/Banner";
import { useProfiles } from "../hooks/api/profile";

const Home: NextPage = () => {
  const profileData = useProfiles();
  const { l10n } = useLocalization();

  if (!profileData.data) {
    // TODO: Show a loading spinner?
    return null;
  }

  const profile = profileData.data[0];

  const currentSettingWarning = profile.server_storage ? null : (
    <div className={styles.bannerWrapper}>
      <Banner title={l10n.getString("settings-warning-collection-off-heading")}>
        {l10n.getString("settings-warning-collection-off-description")}
      </Banner>
    </div>
  );

  const saveSettings: FormEventHandler = (event) => {
    event.preventDefault();
  };

  return (
    <>
      <Layout>
        <div className={styles.settingsPage}>
          {currentSettingWarning}
          <div className={styles.settingsFormWrapper}>
            <form onSubmit={saveSettings} className={styles.settingsForm}>
              <div className={styles.field}>
                <h2 className={styles.fieldHeading}>
                  {l10n.getString("setting-label-collection-heading-v2")}
                </h2>
                <div className={styles.fieldContent}>
                  <input
                    type="checkbox"
                    name="label-collection"
                    id="label-collection"
                    checked={profile.server_storage}
                  />
                  <label htmlFor="label-collection">
                    {l10n.getString("setting-label-collection-description")}
                  </label>
                </div>
              </div>
            </form>
          </div>
        </div>
      </Layout>
    </>
  );
};

export default Home;

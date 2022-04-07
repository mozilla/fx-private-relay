import { useLocalization } from "@fluent/react";
import type { NextPage } from "next";
import { FormEventHandler, useEffect, useReducer, useState } from "react";
import { toast } from "react-toastify";
import styles from "./settings.module.scss";
import { Layout } from "../../components/layout/Layout";
import { Banner } from "../../components/Banner";
import { useProfiles } from "../../hooks/api/profile";
import messageIcon from "../../../../static/images/icon-message-purple.svg";
import helpIcon from "../../../../static/images/help-purple.svg";
import performanceIcon from "../../../../static/images/performance-purple.svg";
import infoTriangleIcon from "../../../../static/images/icon-orange-info-triangle.svg";
import { NewTabIcon } from "../../components/Icons";
import { Button } from "../../components/Button";
import { getRuntimeConfig } from "../../config";
import { useLocalLabels } from "../../hooks/localLabels";
import { AliasData, useAliases } from "../../hooks/api/aliases";
import { useRuntimeData } from "../../hooks/api/runtimeData";

const Settings: NextPage = () => {
  const runtimeData = useRuntimeData();
  const profileData = useProfiles();
  const { l10n } = useLocalization();
  const [localLabels] = useLocalLabels();
  const aliasData = useAliases();
  const [labelCollectionEnabled, setLabelCollectionEnabled] = useState(
    profileData.data?.[0].server_storage
  );

  const [
    labelCollectionDisabledWarningToggles,
    countLabelCollectionDisabledWarningToggle,
  ] = useReducer((c) => c + 1, 0);
  useEffect(() => {
    countLabelCollectionDisabledWarningToggle();
  }, [labelCollectionEnabled]);

  if (!profileData.isValidating && profileData.error) {
    document.location.assign(getRuntimeConfig().fxaLoginUrl);
  }

  if (!profileData.data || !runtimeData.data) {
    // TODO: Show a loading spinner?
    return null;
  }

  const profile = profileData.data[0];

  const currentSettingWarning = profile.server_storage ? null : (
    <div className={styles["banner-wrapper"]}>
      <Banner title={l10n.getString("settings-warning-collection-off-heading")}>
        {l10n.getString("settings-warning-collection-off-description")}
      </Banner>
    </div>
  );
  // This warning should only be shown when data collection is explicitly toggled off,
  // i.e. not when it is off on page load.
  const labelCollectionWarning =
    labelCollectionDisabledWarningToggles > 1 && !labelCollectionEnabled ? (
      <aside role="alert" className={styles["field-warning"]}>
        <img src={infoTriangleIcon.src} alt="" width={20} />
        <p>{l10n.getString("setting-label-collection-off-warning")}</p>
      </aside>
    ) : null;

  const saveSettings: FormEventHandler = async (event) => {
    event.preventDefault();

    try {
      await profileData.update(profile.id, {
        server_storage: labelCollectionEnabled,
      });

      // After having enabled new server-side data storage, upload the locally stored labels:
      if (
        profileData.data?.[0].server_storage === false &&
        labelCollectionEnabled === true
      ) {
        const uploadLocalLabel = (alias: AliasData) => {
          const localLabel = localLabels?.find(
            (localLabel) =>
              localLabel.type === alias.type && localLabel.id === alias.id
          );
          if (typeof localLabel !== "undefined") {
            aliasData.update(alias, { description: localLabel.description });
          }
        };
        aliasData.randomAliasData.data?.forEach(uploadLocalLabel);
        aliasData.customAliasData.data?.forEach(uploadLocalLabel);
      }

      toast(l10n.getString("success-settings-update"), { type: "success" });
    } catch (e) {
      toast(l10n.getString("error-settings-update"), { type: "error" });
    }
  };

  const contactUsLink = profile.has_premium ? (
    <li>
      <a
        href={`${runtimeData.data.FXA_ORIGIN}/support/?utm_source=${
          getRuntimeConfig().frontendOrigin
        }`}
        target="_blank"
        rel="noopener noreferrer"
        title={l10n.getString("nav-profile-contact-tooltip")}
      >
        <img src={messageIcon.src} alt="" />
        {l10n.getString("settings-meta-contact-label")}
        <NewTabIcon alt="" aria-hidden />
      </a>
    </li>
  ) : null;

  return (
    <>
      <Layout>
        <div className={styles["settings-page"]}>
          <main className={styles.main}>
            {currentSettingWarning}
            <div className={styles["settings-form-wrapper"]}>
              <form onSubmit={saveSettings} className={styles["settings-form"]}>
                <div className={styles.field}>
                  <h2 className={styles["field-heading"]}>
                    {l10n.getString("setting-label-collection-heading-v2")}
                  </h2>
                  <div className={styles["field-content"]}>
                    <div className={styles["field-control"]}>
                      <input
                        type="checkbox"
                        name="label-collection"
                        id="label-collection"
                        defaultChecked={profile.server_storage}
                        onChange={(e) =>
                          setLabelCollectionEnabled(e.target.checked)
                        }
                      />
                      <label htmlFor="label-collection">
                        {l10n.getString("setting-label-collection-description")}
                      </label>
                    </div>
                    {labelCollectionWarning}
                  </div>
                </div>
                <div className={styles.controls}>
                  <Button type="submit">
                    {l10n.getString("settings-button-save-label")}
                  </Button>
                </div>
              </form>
            </div>
          </main>
          <aside className={styles.menu}>
            <h1 className={styles.heading}>
              {l10n.getString("settings-headline")}
            </h1>
            <ul>
              {contactUsLink}
              <li>
                <a
                  href={`https://support.mozilla.org/products/relay/?utm_source=${
                    getRuntimeConfig().frontendOrigin
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={l10n.getString("settings-meta-help-tooltip")}
                >
                  <img src={helpIcon.src} alt="" />
                  {l10n.getString("settings-meta-help-label")}
                  <NewTabIcon alt="" aria-hidden />
                </a>
              </li>
              <li>
                <a
                  href="https://status.relay.firefox.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title={l10n.getString("settings-meta-status-tooltip")}
                >
                  <img src={performanceIcon.src} alt="" />
                  {l10n.getString("settings-meta-status-label")}
                  <NewTabIcon alt="" aria-hidden />
                </a>
              </li>
            </ul>
          </aside>
        </div>
      </Layout>
    </>
  );
};

export default Settings;

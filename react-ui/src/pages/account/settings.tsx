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
import { Button } from "../../components/Button";

const Settings: NextPage = () => {
  const profileData = useProfiles();
  const { l10n } = useLocalization();
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
  // This warning should only be shown when data collection is explicitly toggled off,
  // i.e. not when it is off on page load.
  const labelCollectionWarning =
    labelCollectionDisabledWarningToggles > 1 && !labelCollectionEnabled ? (
      <aside role="alert" className={styles.fieldWarning}>
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
      toast(l10n.getString("success-settings-update"), { type: "success" });
    } catch (e) {
      toast(l10n.getString("error-settings-update"), { type: "error" });
    }
  };

  const contactUsLink = profile.has_premium ? (
    <li>
      <a
        href={`${process.env.NEXT_PUBLIC_FXA_SUPPORT_URL}?utm_source=${process.env.NEXT_PUBLIC_SITE_ORIGIN}`}
        target="_blank"
        rel="noopener noreferrer"
        title={l10n.getString("settings-meta-contact-tooltip")}
      >
        <img src={messageIcon.src} alt="" />
        {l10n.getString("settings-meta-contact-label")}
      </a>
    </li>
  ) : null;

  return (
    <>
      <Layout>
        <div className={styles.settingsPage}>
          <main className={styles.main}>
            {currentSettingWarning}
            <div className={styles.settingsFormWrapper}>
              <form onSubmit={saveSettings} className={styles.settingsForm}>
                <div className={styles.field}>
                  <h2 className={styles.fieldHeading}>
                    {l10n.getString("setting-label-collection-heading-v2")}
                  </h2>
                  <div className={styles.fieldContent}>
                    <div className={styles.fieldControl}>
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
                  href={`https://support.mozilla.org/products/relay/?utm_source=${process.env.NEXT_PUBLIC_SITE_ORIGIN}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={l10n.getString("settings-meta-help-tooltip")}
                >
                  <img src={helpIcon.src} alt="" />
                  {l10n.getString("settings-meta-help-label")}
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

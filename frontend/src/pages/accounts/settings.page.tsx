import { useLocalization } from "@fluent/react";
import type { NextPage } from "next";
import {
  FormEventHandler,
  MouseEventHandler,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { toast } from "react-toastify";
import styles from "./settings.module.scss";
import { Layout } from "../../components/layout/Layout";
import { Banner } from "../../components/Banner";
import { useProfiles } from "../../hooks/api/profile";
import messageIcon from "../../../../static/images/icon-message-purple.svg";
import copyIcon from "../../../../static/images/copy-to-clipboard.svg";
import helpIcon from "../../../../static/images/help-purple.svg";
import performanceIcon from "../../../../static/images/performance-purple.svg";
import infoTriangleIcon from "../../../../static/images/icon-orange-info-triangle.svg";
import { HideIcon, NewTabIcon } from "../../components/Icons";
import { Button } from "../../components/Button";
import { getRuntimeConfig } from "../../config";
import { useLocalLabels } from "../../hooks/localLabels";
import { AliasData, useAliases } from "../../hooks/api/aliases";
import { useRuntimeData } from "../../hooks/api/runtimeData";
import { useAddonData } from "../../hooks/addon";

const Settings: NextPage = () => {
  const runtimeData = useRuntimeData();
  const profileData = useProfiles();
  const { l10n } = useLocalization();
  const [localLabels] = useLocalLabels();
  const aliasData = useAliases();
  const addonData = useAddonData();
  const [labelCollectionEnabled, setLabelCollectionEnabled] = useState(
    profileData.data?.[0].server_storage
  );
  const [trackerRemovalEnabled, setTrackerRemovalEnabled] = useState(
    profileData.data?.[0].remove_email_tracker_default
  );
  const [justCopiedApiKey, setJustCopiedApiKey] = useState(false);
  const apiKeyElementRef = useRef<HTMLInputElement>(null);

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
      <Banner
        title={l10n.getString("settings-warning-collection-off-heading-2")}
      >
        {l10n.getString("settings-warning-collection-off-description-2")}
      </Banner>
    </div>
  );
  // This warning should only be shown when data collection is explicitly toggled off,
  // i.e. not when it is off on page load.
  const labelCollectionWarning =
    labelCollectionDisabledWarningToggles > 1 && !labelCollectionEnabled ? (
      <aside role="alert" className={styles["field-warning"]}>
        <img src={infoTriangleIcon.src} alt="" width={20} />
        <p>{l10n.getString("setting-label-collection-off-warning-2")}</p>
      </aside>
    ) : null;

  // This warning should only be shown when the user currently does not have
  // tracker removal enabled, regardless of whether they've toggled it on or off
  // without saving their settings yet:
  const trackerRemovalWarning =
    profile.remove_email_tracker_default === false ? (
      <aside role="alert" className={styles["field-warning"]}>
        <img src={infoTriangleIcon.src} alt="" width={20} />
        <p>{l10n.getString("setting-tracker-removal-warning")}</p>
      </aside>
    ) : null;

  const saveSettings: FormEventHandler = async (event) => {
    event.preventDefault();

    try {
      await profileData.update(profile.id, {
        server_storage: labelCollectionEnabled,
        remove_email_tracker_default:
          typeof profile.remove_email_tracker_default === "boolean"
            ? trackerRemovalEnabled
            : undefined,
      });

      // After having enabled new server-side data storage, upload the locally stored labels:
      if (
        profileData.data?.[0].server_storage === false &&
        labelCollectionEnabled === true
      ) {
        const uploadLocalLabel = (alias: AliasData) => {
          const localLabel = localLabels?.find(
            (localLabel) =>
              localLabel.mask_type === alias.mask_type &&
              localLabel.id === alias.id
          );
          if (typeof localLabel !== "undefined") {
            aliasData.update(alias, { description: localLabel.description });
          }
        };
        aliasData.randomAliasData.data?.forEach(uploadLocalLabel);
        aliasData.customAliasData.data?.forEach(uploadLocalLabel);
      }

      toast(l10n.getString("success-settings-update"), { type: "success" });

      if (profileData.data?.[0].server_storage !== labelCollectionEnabled) {
        // If the user has changed their preference w.r.t. server storage of address labels,
        // notify the add-on about it:
        addonData.sendEvent("serverStorageChange");
      }
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
        <NewTabIcon />
      </a>
    </li>
  ) : null;

  const copyApiKeyToClipboard: MouseEventHandler<HTMLButtonElement> = () => {
    navigator.clipboard.writeText(profile.api_token);
    apiKeyElementRef.current?.select();
    setJustCopiedApiKey(true);
    setTimeout(() => setJustCopiedApiKey(false), 1000);
  };

  // To allow us to add this UI before the back-end is updated, we only show it
  // when the profiles API actually returns a property `remove_email_tracker_default`.
  // Once it does, the commit that introduced this comment can be reverted.
  const trackerRemovalSetting =
    typeof profile.remove_email_tracker_default === "boolean" ? (
      <div className={styles.field}>
        <h2 className={styles["field-heading"]}>
          <span className={styles["field-heading-icon-wrapper"]}>
            <HideIcon alt="" />
            {l10n.getString("setting-tracker-removal-heading")}
          </span>
        </h2>
        <div className={styles["field-content"]}>
          <div className={styles["field-control"]}>
            <input
              type="checkbox"
              name="tracker-removal"
              id="tracker-removal"
              defaultChecked={profile.remove_email_tracker_default}
              onChange={(e) => setTrackerRemovalEnabled(e.target.checked)}
            />
            <label htmlFor="tracker-removal">
              <p>{l10n.getString("setting-tracker-removal-description")}</p>
              <p>{l10n.getString("setting-tracker-removal-note")}</p>
            </label>
          </div>
          {trackerRemovalWarning}
        </div>
      </div>
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
                        {l10n.getString(
                          "setting-label-collection-description-2"
                        )}
                      </label>
                    </div>
                    {labelCollectionWarning}
                  </div>
                </div>
                <div className={styles.field}>
                  <h2 className={styles["field-heading"]}>
                    <label htmlFor="api-key">
                      {l10n.getString("setting-label-api-key")}
                    </label>
                  </h2>
                  <div
                    className={`${styles["copy-api-key-content"]} ${styles["field-content"]}`}
                  >
                    <input
                      id="api-key"
                      ref={apiKeyElementRef}
                      className={styles["copy-api-key-display"]}
                      value={profile.api_token}
                      size={profile.api_token.length}
                      readOnly={true}
                    />
                    <span className={styles["copy-controls"]}>
                      <span className={styles["copy-button-wrapper"]}>
                        <button
                          type="button"
                          className={styles["copy-button"]}
                          title={l10n.getString("settings-button-copy")}
                          onClick={copyApiKeyToClipboard}
                        >
                          <img
                            src={copyIcon.src}
                            alt={l10n.getString("settings-button-copy")}
                            className={styles["copy-icon"]}
                          />
                        </button>
                        <span
                          aria-hidden={!justCopiedApiKey}
                          className={`${styles["copied-confirmation"]} ${
                            justCopiedApiKey ? styles["is-shown"] : ""
                          }`}
                        >
                          {l10n.getString("setting-api-key-copied")}
                        </span>
                      </span>
                    </span>
                  </div>
                </div>
                {trackerRemovalSetting}
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
                  href={`${getRuntimeConfig().supportUrl}?utm_source=${
                    getRuntimeConfig().frontendOrigin
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={l10n.getString("settings-meta-help-tooltip")}
                >
                  <img src={helpIcon.src} alt="" />
                  {l10n.getString("settings-meta-help-label")}
                  <NewTabIcon />
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
                  <NewTabIcon />
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

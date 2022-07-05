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
import {
  InfoTriangleIcon,
  HideIcon,
  NewTabIcon,
  PerformanceIcon,
  CopyIcon,
  SupportIcon,
  ContactIcon,
} from "../../components/Icons";
import { Button } from "../../components/Button";
import { getRuntimeConfig } from "../../config";
import { useLocalLabels } from "../../hooks/localLabels";
import { AliasData, useAliases } from "../../hooks/api/aliases";
import { useRuntimeData } from "../../hooks/api/runtimeData";
import { useAddonData } from "../../hooks/addon";
import { isFlagActive } from "../../functions/waffle";

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
    profileData.data?.[0].remove_level_one_email_trackers
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
      <div role="alert" className={styles["field-warning"]}>
        <InfoTriangleIcon alt="" />
        <p>{l10n.getString("setting-label-collection-off-warning-2")}</p>
      </div>
    ) : null;

  const saveSettings: FormEventHandler = async (event) => {
    event.preventDefault();

    try {
      await profileData.update(profile.id, {
        server_storage: labelCollectionEnabled,
        remove_level_one_email_trackers:
          typeof profile.remove_level_one_email_trackers === "boolean"
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
        <ContactIcon className={styles["menu-icon"]} alt="" />
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
  // when the profiles API actually returns a property `remove_level_one_email_trackers`.
  // Once it does, the commit that introduced this comment can be reverted.
  const trackerRemovalSetting =
    typeof profile.remove_level_one_email_trackers === "boolean" &&
    isFlagActive(runtimeData.data, "tracker_removal") ? (
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
              defaultChecked={profile.remove_level_one_email_trackers}
              onChange={(e) => setTrackerRemovalEnabled(e.target.checked)}
            />
            <label htmlFor="tracker-removal">
              <p>{l10n.getString("setting-tracker-removal-description")}</p>
              <p>{l10n.getString("setting-tracker-removal-note")}</p>
            </label>
          </div>
          <div className={styles["field-warning"]}>
            <InfoTriangleIcon alt="" />
            <p>{l10n.getString("setting-tracker-removal-warning")}</p>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <Layout runtimeData={runtimeData.data}>
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
                    <div className={styles["settings-api-key-wrapper"]}>
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
                            <CopyIcon
                              alt={l10n.getString("settings-button-copy")}
                              className={styles["copy-icon"]}
                              width={24}
                              height={24}
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
                    <div className={styles["settings-api-key-copy"]}>
                      {l10n.getString("settings-api-key-description")}{" "}
                      <b>
                        {l10n.getString("settings-api-key-description-bolded")}
                      </b>
                    </div>
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
                  <SupportIcon className={styles["menu-icon"]} alt="" />
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
                  <PerformanceIcon className={styles["menu-icon"]} alt="" />
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

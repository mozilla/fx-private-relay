import { useRelayNumber } from "../../../hooks/api/relayNumber";
import styles from "./PhoneDashboard.module.scss";
import {
  CopyIcon,
  ForwardIcon,
  BlockIcon,
  ChevronRightIcon,
} from "../../../components/Icons";
import { MouseEventHandler, useState } from "react";
import { useRealPhonesData } from "../../../hooks/api/realPhone";
import { useLocalization } from "@fluent/react";
import { useInboundContact } from "../../../hooks/api/inboundContact";
import { useProfiles } from "../../../hooks/api/profile";
import { SendersPanelView } from "./SendersPanelView";
import { formatPhone } from "../../../functions/formatPhone";
import { getLocale } from "../../../functions/getLocale";
import { parseDate } from "../../../functions/parseDate";

export const PhoneDashboard = () => {
  const { l10n } = useLocalization();
  const profileData = useProfiles();
  const relayNumber = useRelayNumber();
  const realPhone = useRealPhonesData();
  const relayNumberData = relayNumber.data?.[0];
  const realPhoneData = realPhone.data?.[0];
  const formattedPhoneNumber = formatPhone(realPhoneData?.number ?? "", {
    withCountryCode: true,
  });
  const formattedRelayNumber = formatPhone(relayNumberData?.number ?? "", {
    withCountryCode: true,
  });
  const inboundContactData = useInboundContact();
  const inboundArray = inboundContactData.data;

  const [justCopiedPhoneNumber, setJustCopiedPhoneNumber] = useState(false);

  const [enableForwarding, setEnableForwarding] = useState(
    relayNumberData ? relayNumberData.enabled : false
  );
  const [showingPrimaryDashboard, toggleDashboardPanel] = useState(true);
  const dateToFormat = realPhone.data?.[0].verified_date
    ? parseDate(realPhone.data[0].verified_date)
    : new Date();
  const dateFormatter = new Intl.DateTimeFormat(getLocale(l10n), {
    dateStyle: "medium",
  });

  const toggleForwarding = () => {
    if (relayNumberData?.id) {
      setEnableForwarding(!enableForwarding);
      relayNumber.setForwardingState(!enableForwarding, relayNumberData.id);
    }
  };

  const copyPhoneNumber: MouseEventHandler<HTMLButtonElement> = () => {
    if (relayNumberData?.number) {
      navigator.clipboard.writeText(relayNumberData.number);
      setJustCopiedPhoneNumber(true);
      setTimeout(() => setJustCopiedPhoneNumber(false), 1000);
    }
  };

  const toggleSendersPanel = () => {
    toggleDashboardPanel(!showingPrimaryDashboard);
  };

  //TODO: Add real data to phone stats
  const phoneStatistics = (
    <div className={styles["phone-statistics-container"]}>
      <div className={styles["phone-statistics"]}>
        <p className={styles["phone-statistics-title"]}>12:04 min</p>
        <p className={styles["phone-statistics-body"]}>
          {l10n.getString("phone-statistics-remaining-call-minutes")}
        </p>
      </div>

      <div className={styles["phone-statistics"]}>
        <p className={styles["phone-statistics-title"]}>36</p>
        <p className={styles["phone-statistics-body"]}>
          {l10n.getString("phone-statistics-remaining-texts")}
        </p>
      </div>

      <div
        className={`${styles["phone-statistics"]} ${
          enableForwarding ? "" : styles["inactive-statistics"]
        }`}
      >
        <p className={styles["phone-statistics-title"]}>7</p>
        <p className={styles["phone-statistics-body"]}>
          {l10n.getString("phone-statistics-calls-texts-forwarded")}
        </p>
      </div>

      <div
        className={`${styles["phone-statistics"]} ${
          enableForwarding ? styles["inactive-statistics"] : ""
        }`}
      >
        <p className={styles["phone-statistics-title"]}>0</p>
        <p className={styles["phone-statistics-body"]}>
          {l10n.getString("phone-statistics-calls-texts-blocked")}
        </p>
      </div>
    </div>
  );

  const phoneControls = (
    <div className={styles["phone-controls-container"]}>
      <div className={styles["phone-controls"]}>
        <button
          onClick={toggleForwarding}
          className={`${styles["forwarding-controls-button"]} ${
            enableForwarding ? styles["active-button"] : ""
          }`}
        >
          <ForwardIcon
            alt="Forwarding All Messages"
            className={styles["forward-icon"]}
            width={15}
            height={15}
          />
        </button>
        <button
          onClick={toggleForwarding}
          className={`${styles["forwarding-controls-button"]} ${
            enableForwarding ? "" : styles["active-button"]
          }`}
        >
          <BlockIcon
            alt="Blocking All Messages"
            className={styles["block-icon"]}
            width={15}
            height={15}
          />
        </button>
      </div>
      <div className={styles["phone-controls-description"]}>
        {enableForwarding ? (
          <span>{l10n.getString("phone-dashboard-forwarding-enabled")}</span>
        ) : (
          <span>{l10n.getString("phone-dashboard-forwarding-blocked")}</span>
        )}
      </div>
    </div>
  );

  const phoneMetadata = (
    <div className={styles["metadata-container"]}>
      <dl>
        <div className={`${styles["forward-target"]} ${styles.metadata}`}>
          <dt>{l10n.getString("phone-dashboard-metadata-forwarded-to")}</dt>
          <dd>{formattedPhoneNumber}</dd>
        </div>
        <div className={`${styles["date-created"]} ${styles.metadata}`}>
          <dt>{l10n.getString("phone-dashboard-metadata-date-created")}</dt>
          <dd>{dateFormatter.format(dateToFormat)}</dd>
        </div>
      </dl>
    </div>
  );

  const primaryPanel = (
    <div id="primary-panel" className={styles["dashboard-card"]}>
      <div className={styles["dashboard-card-header"]}>
        <span className={styles["header-phone-number"]}>
          <span>{formattedRelayNumber}</span>
          <span className={styles["copy-controls"]}>
            <span className={styles["copy-button-wrapper"]}>
              <button
                type="button"
                className={styles["copy-button"]}
                title="Copied"
                onClick={copyPhoneNumber}
              >
                <CopyIcon
                  alt={l10n.getString("setting-api-key-copied-alt")}
                  className={styles["copy-icon"]}
                  width={20}
                  height={20}
                />
              </button>
              <span
                aria-hidden={!justCopiedPhoneNumber}
                className={`${styles["copied-confirmation"]} ${
                  justCopiedPhoneNumber ? styles["is-shown"] : ""
                }`}
              >
                {l10n.getString("phone-dashboard-number-copied")}
              </span>
            </span>
          </span>
        </span>
        <button
          type="button"
          className={styles["senders-cta"]}
          onClick={toggleSendersPanel}
        >
          <span>{l10n.getString("phone-dashboard-senders-header")}</span>
          <ChevronRightIcon
            alt="See Caller and SMS Senders"
            className={styles["nav-icon"]}
            width={20}
            height={20}
          />
        </button>
      </div>
      {phoneStatistics}
      {phoneControls}
      {phoneMetadata}
    </div>
  );

  function getSendersPanelType() {
    if (profileData.data?.[0].store_phone_log === false) {
      return "disabled";
    }
    if (inboundArray && inboundArray.length === 0) {
      return "empty";
    }
    return "primary";
  }

  return (
    <div className={styles["main-phone-wrapper"]}>
      {showingPrimaryDashboard && inboundContactData !== undefined ? (
        // Primary Panel
        <>{primaryPanel}</>
      ) : (
        // Caller and SMS Senders Panel
        <SendersPanelView
          type={getSendersPanelType()}
          back_btn={toggleSendersPanel}
        />
      )}
    </div>
  );
};

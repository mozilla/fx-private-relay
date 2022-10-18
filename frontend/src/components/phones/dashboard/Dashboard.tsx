import { useToggleState } from "react-stately";
import { useToggleButton } from "react-aria";
import { useRelayNumber } from "../../../hooks/api/relayNumber";
import styles from "./PhoneDashboard.module.scss";
import {
  CopyIcon,
  ForwardIcon,
  BlockIcon,
  ChevronRightIcon,
} from "../../../components/Icons";
import { MouseEventHandler, useRef, useState } from "react";
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

  const [showingPrimaryDashboard, toggleDashboardPanel] = useState(true);
  const dateToFormat = realPhone.data?.[0].verified_date
    ? parseDate(realPhone.data[0].verified_date)
    : new Date();
  const dateFormatter = new Intl.DateTimeFormat(getLocale(l10n), {
    dateStyle: "medium",
  });

  const forwardToggleButtonRef = useRef<HTMLButtonElement>(null);
  const forwardToggleState = useToggleState({
    defaultSelected: relayNumberData?.enabled ?? false,
    onChange: (isSelected) => {
      if (typeof relayNumberData?.id === "number") {
        relayNumber.setForwardingState(isSelected, relayNumberData.id);
      }
    },
  });
  const forwardToggleButtonProps = useToggleButton(
    {},
    forwardToggleState,
    forwardToggleButtonRef
  ).buttonProps;

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
        <p className={styles["phone-statistics-title"]}>
          {relayNumberData?.remaining_minutes}
        </p>
        <p className={styles["phone-statistics-body"]}>
          {l10n.getString("phone-statistics-remaining-call-minutes")}
        </p>
      </div>

      <div className={styles["phone-statistics"]}>
        <p className={styles["phone-statistics-title"]}>
          {relayNumberData?.remaining_texts}
        </p>
        <p className={styles["phone-statistics-body"]}>
          {l10n.getString("phone-statistics-remaining-texts")}
        </p>
      </div>

      <div
        className={`${styles["phone-statistics"]} ${
          relayNumberData?.enabled ? "" : styles["inactive-statistics"]
        }`}
      >
        <p className={styles["phone-statistics-title"]}>
          {relayNumberData?.calls_and_texts_forwarded}
        </p>
        <p className={styles["phone-statistics-body"]}>
          {l10n.getString("phone-statistics-calls-texts-forwarded")}
        </p>
      </div>

      <div
        className={`${styles["phone-statistics"]} ${
          relayNumberData?.enabled ? styles["inactive-statistics"] : ""
        }`}
      >
        <p className={styles["phone-statistics-title"]}>
          {relayNumberData?.calls_and_texts_blocked}
        </p>
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
          {...forwardToggleButtonProps}
          ref={forwardToggleButtonRef}
          className={styles["forwarding-toggle"]}
          title={
            forwardToggleState.isSelected
              ? l10n.getString(
                  "phone-dashboard-forwarding-toggle-disable-tooltip"
                )
              : l10n.getString(
                  "phone-dashboard-forwarding-toggle-enable-tooltip"
                )
          }
        >
          <span
            aria-hidden={!forwardToggleState.isSelected}
            className={`${styles["forwarding-toggle-state"]} ${styles["forward-state"]}`}
          >
            <ForwardIcon alt="" width={15} height={15} />
            {l10n.getString("phone-dashboard-forwarding-toggle-enable-label")}
          </span>
          <span
            aria-hidden={forwardToggleState.isSelected}
            className={`${styles["forwarding-toggle-state"]} ${styles["block-state"]}`}
          >
            <BlockIcon alt="" width={15} height={15} />
            {l10n.getString("phone-dashboard-forwarding-toggle-disable-label")}
          </span>
        </button>
      </div>
      <div className={styles["phone-controls-description"]}>
        {relayNumberData?.enabled ? (
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

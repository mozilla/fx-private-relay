/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import Moment from "react-moment";
import { useRelayNumber } from "../../../hooks/api/relayNumber";
import styles from "./PhoneDashboard.module.scss";
import { CopyIcon, ForwardIcon, BlockIcon } from "../../../components/Icons";
import { MouseEventHandler, useState } from "react";
import { useRealPhonesData } from "../../../hooks/api/realPhone";
import { useLocalization } from "@fluent/react";
Moment.globalFormat = "D MMM YYYY";

export const PhoneDashboard = () => {
  const { l10n } = useLocalization();

  const relayNumber = useRelayNumber();
  const realPhone = useRealPhonesData();
  const relayNumberData = relayNumber.data?.[0];
  const realPhoneData = realPhone.data?.[0];
  const phoneDateCreated = useRealPhonesData();
  const [justCopiedPhoneNumber, setJustCopiedPhoneNumber] = useState(false);

  const [enableForwarding, setEnableForwarding] = useState(
    relayNumberData ? relayNumberData.enabled : false
  );

  const dateToFormat = phoneDateCreated.data?.[0].verified_date!;

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
          className={`${styles["base-button"]} ${
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
          className={`${styles["base-button"]} ${
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
          <dd>{realPhoneData?.number}</dd>
        </div>
        <div className={`${styles["date-created"]} ${styles.metadata}`}>
          <dt>
            <dt>{l10n.getString("phone-dashboard-metadata-date-created")}</dt>
          </dt>
          <dd>
            <Moment>{dateToFormat}</Moment>
          </dd>
        </div>
      </dl>
    </div>
  );

  return (
    <main className={styles["main-phone-wrapper"]}>
      <div className={styles["dashboard-card"]}>
        <span className={styles["header-phone-number"]}>
          {relayNumberData?.number
            ? formatPhoneNumberToUSDisplay(relayNumberData.number)
            : ""}
          <span className={styles["copy-controls"]}>
            <span className={styles["copy-button-wrapper"]}>
              <button
                type="button"
                className={styles["copy-button"]}
                title="Copied"
                onClick={copyPhoneNumber}
              >
                <CopyIcon
                  alt="test"
                  className={styles["copy-icon"]}
                  width={32}
                  height={32}
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

        {phoneStatistics}
        {phoneControls}
        {phoneMetadata}
      </div>
    </main>
  );
};

function formatPhoneNumberToUSDisplay(e164Number: string) {
  const friendlyPhoneNumber = e164Number.split("");
  friendlyPhoneNumber?.splice(2, 0, " (");
  friendlyPhoneNumber?.splice(6, 0, ") ");
  friendlyPhoneNumber?.join("");
  return friendlyPhoneNumber;
}

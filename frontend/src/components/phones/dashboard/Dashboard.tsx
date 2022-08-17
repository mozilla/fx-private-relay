/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import Moment from "react-moment";
import { useRelayNumber } from "../../../hooks/api/relayNumber";
import styles from "./PhoneDashboard.module.scss";
import {
  CopyIcon,
  ForwardIcon,
  BlockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../../../components/Icons";
import { MouseEventHandler, useState } from "react";
import { useRealPhonesData } from "../../../hooks/api/realPhone";
import { useLocalization } from "@fluent/react";
import { useInboundContact } from "../../../hooks/api/inboundContact";
import moment from "moment";

export const PhoneDashboard = () => {
  const { l10n } = useLocalization();

  const relayNumber = useRelayNumber();
  const realPhone = useRealPhonesData();
  const relayNumberData = relayNumber.data?.[0];
  const realPhoneData = realPhone.data?.[0];
  const phoneDateCreated = useRealPhonesData();
  const inboundContactData = useInboundContact();
  const [justCopiedPhoneNumber, setJustCopiedPhoneNumber] = useState(false);

  const [enableForwarding, setEnableForwarding] = useState(
    relayNumberData ? relayNumberData.enabled : false
  );
  const [showingPrimaryDashboard, toggleDashboardPanel] = useState(true);

  const dateToFormat = phoneDateCreated.data?.[0].verified_date!;

  console.log(inboundContactData.data);

  const inboundArray = inboundContactData.data;

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

  const showCallerSMSSendersPanel: MouseEventHandler<
    HTMLButtonElement
  > = () => {
    toggleDashboardPanel(!showingPrimaryDashboard);
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
            <Moment format="D MMM YYYY">{dateToFormat}</Moment>
          </dd>
        </div>
      </dl>
    </div>
  );

  const primaryPanel = (
    <div id="primary-panel" className={styles["dashboard-card"]}>
      <div className={styles["dashboard-card-header"]}>
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
        <button
          type="button"
          className={styles["senders-cta"]}
          onClick={showCallerSMSSendersPanel}
        >
          <span>{l10n.getString("phone-dashboard-senders-header")}</span>
          <ChevronRightIcon
            alt="See Caller and SMS Senders"
            className={styles["nav-icon"]}
            width={25}
            height={25}
          />
        </button>
      </div>
      {phoneStatistics}
      {phoneControls}
      {phoneMetadata}
    </div>
  );

  const calendarStrings = {
    //TODO: Add eng strings to pendingTranslations.ftl
    lastDay: "[Yesterday at] LT",
    sameDay: "[Today at] LT",
    lastWeek: "L LT",
    nextWeek: "L LT",
    sameElse: "L LT",
  };

  const inboundContactArray = inboundArray
    ?.sort(
      (a, b) =>
        // Sorted with the latest message/call being placed first
        moment(b.last_inbound_date).unix() - moment(a.last_inbound_date).unix()
    )
    .map((data) => {
      return (
        <li
          key={data.id}
          className={data.blocked ? styles["greyed-contact"] : ""}
        >
          <span>{formatPhoneNumberToUSDisplay(data.inbound_number)}</span>
          <span>
            <Moment calendar={calendarStrings}>{data.last_inbound_date}</Moment>
          </span>
          <span>
            <button
              onClick={() =>
                inboundContactData.setForwardingState(!data.blocked, data.id)
              }
              //onClick={toggleInboundContactForwarding(data.blocked, data.id)}
              className={styles["block-btn"]}
            >
              {data.blocked ? "Unblock" : "Block"}
            </button>
          </span>
        </li>
      );
    });

  const callerSMSSendersPanel = (
    <div id="secondary-panel" className={styles["dashboard-card"]}>
      <div className={styles["dashboard-card-caller-sms-senders-header"]}>
        <span>
          <button
            type="button"
            onClick={showCallerSMSSendersPanel}
            className={styles["caller-sms-logs-back-btn"]}
          >
            <ChevronLeftIcon
              alt="Back to Primary Dashboard"
              className={styles["nav-icon"]}
              width={25}
              height={25}
            />
          </button>
        </span>
        <span className={styles["caller-sms-logs-title"]}>
          {l10n.getString("phone-dashboard-senders-header")}
        </span>
        <span></span>
      </div>
      <ul className={styles["caller-sms-senders-table"]}>
        <li className={styles["greyed-contact"]}>
          <span>
            {l10n.getString("phone-dashboard-sender-table-title-sender")}
          </span>
          <span>
            {l10n.getString("phone-dashboard-sender-table-title-activity")}
          </span>
          <span>
            {l10n.getString("phone-dashboard-sender-table-title-action")}
          </span>
        </li>
        {inboundContactArray}
      </ul>
    </div>
  );

  return (
    <main className={styles["main-phone-wrapper"]}>
      {showingPrimaryDashboard ? (
        // Primary Panel
        <>{primaryPanel}</>
      ) : (
        // Caller and SMS Senders Panel
        <>{callerSMSSendersPanel}</>
      )}
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

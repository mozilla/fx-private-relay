import { useToggleState } from "react-stately";
import { useToggleButton } from "react-aria";
import { toast } from "react-toastify";
import { useRelayNumber } from "../../../hooks/api/relayNumber";
import styles from "./PhoneDashboard.module.scss";
import {
  CopyIcon,
  ForwardIcon,
  BlockIcon,
  ChevronRightIcon,
} from "../../Icons";
import { MouseEventHandler, useRef, useState } from "react";
import { VerifiedPhone } from "../../../hooks/api/realPhone";
import { useInboundContact } from "../../../hooks/api/inboundContact";
import { ProfileData } from "../../../hooks/api/profile";
import { SendersPanelView } from "./SendersPanelView";
import { formatPhone } from "../../../functions/formatPhone";
import { getLocale } from "../../../functions/getLocale";
import { parseDate } from "../../../functions/parseDate";
import { Tips } from "../../dashboard/tips/Tips";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import { DismissalData } from "../../../hooks/localDismissal";
import { Banner } from "../../Banner";
import { useL10n } from "../../../hooks/l10n";

export type Props = {
  profile: ProfileData;
  runtimeData: RuntimeData;
  realPhone: VerifiedPhone;
  dismissal: {
    resendSMS: DismissalData;
  };
  onRequestContactCard: () => Promise<Response>;
};

export const PhoneDashboard = (props: Props) => {
  const l10n = useL10n();
  const relayNumber = useRelayNumber();
  const relayNumberData = relayNumber.data?.[0];
  const formattedPhoneNumber = formatPhone(props.realPhone.number ?? "", {
    withCountryCode: true,
  });
  const formattedRelayNumber = formatPhone(relayNumberData?.number ?? "", {
    withCountryCode: true,
  });
  const inboundContactData = useInboundContact();
  const inboundArray = inboundContactData.data;

  const [justCopiedPhoneNumber, setJustCopiedPhoneNumber] = useState(false);

  const resendWelcomeText = !props.dismissal.resendSMS.isDismissed && (
    <div className={styles["banner-wrapper"]}>
      <Banner
        title={l10n.getString("phone-banner-resend-welcome-sms-title")}
        type="info"
        cta={{
          content: l10n.getString("phone-banner-resend-welcome-sms-cta"),
          onClick: async () => {
            await props.onRequestContactCard();
            toast(l10n.getString("phone-banner-resend-welcome-sms-toast-msg"), {
              type: "success",
            });
            props.dismissal.resendSMS.dismiss();
          },
          gaViewPing: {
            category: "Resend Welcome SMS",
            label: "phone-page-banner-resend-welcome",
          },
        }}
        dismissal={{
          key: `resend-sms-banner-${props.profile?.id}`,
        }}
      >
        {l10n.getString("phone-banner-resend-welcome-sms-body")}
      </Banner>
    </div>
  );

  const [showingPrimaryDashboard, toggleDashboardPanel] = useState(true);
  const dateToFormat = props.realPhone.verified_date
    ? parseDate(props.realPhone.verified_date)
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
      // removing the + from the number to make it easier to copy
      const RelayNumber = relayNumberData.number.replace("+", "");
      navigator.clipboard.writeText(RelayNumber);
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
    if (props.profile.store_phone_log === false) {
      return "disabled";
    }
    if (inboundArray && inboundArray.length === 0) {
      return "empty";
    }
    return "primary";
  }

  return (
    <div className={styles["main-phone-wrapper"]}>
      <main className={styles["content-wrapper"]}>
        {resendWelcomeText}
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
      </main>
      <Tips profile={props.profile} runtimeData={props.runtimeData} />
    </div>
  );
};

import styles from "./PhoneDashboard.module.scss";
import {
  ChevronLeftIcon,
  ForwardedCallIcon,
  ForwardedTextIcon,
  WarningFilledIcon,
} from "../../../components/Icons";
import disabledSendersDataIllustration from "./images/sender-data-disabled-illustration.svg";
import emptySenderDataIllustration from "./images/sender-data-empty-illustration.svg";
import { useLocalization } from "@fluent/react";
import { useInboundContact } from "../../../hooks/api/inboundContact";
import { OutboundLink } from "react-ga";
import { formatPhone } from "../../../functions/formatPhone";
import { parseDate } from "../../../functions/parseDate";
import { getLocale } from "../../../functions/getLocale";

export type Props = {
  type: "primary" | "disabled" | "empty";
  back_btn: () => void;
};

export const SendersPanelView = (props: Props) => {
  const { l10n } = useLocalization();
  const inboundContactData = useInboundContact();
  const inboundArray = inboundContactData.data;
  const dateTimeFormatter = new Intl.DateTimeFormat(getLocale(l10n), {
    dateStyle: "short",
    timeStyle: "short",
  });

  const emptyCallerSMSSendersPanel = (
    <div className={styles["senders-panel"]}>
      <img
        src={emptySenderDataIllustration.src}
        alt="Empty Senders Data Illustration"
        width={130}
      />
      <p className={styles["senders-panel-body"]}>
        {l10n.getString("phone-dashboard-sender-empty-body")}
      </p>
    </div>
  );

  const disabledCallerSMSSendersPanel = (
    <div className={styles["senders-panel"]}>
      <img
        src={disabledSendersDataIllustration.src}
        alt="Disabled Senders Data Illustration"
        width={130}
      />
      <p className={styles["senders-panel-body"]}>
        <WarningFilledIcon
          alt=""
          className={styles["warning-icon"]}
          width={20}
          height={20}
        />
        {l10n.getString("phone-dashboard-sender-disabled-body")}
      </p>
      <div className={styles["update-settings-cta"]}>
        <OutboundLink
          to="/accounts/settings/"
          eventLabel="Update Settings"
          target="_blank"
          rel="noopener noreferrer"
        >
          {l10n.getString("phone-dashboard-sender-disabled-update-settings")}
        </OutboundLink>
      </div>
    </div>
  );

  const inboundContactArray =
    inboundContactData &&
    inboundArray
      ?.sort(
        (a, b) =>
          // Sort by last sent date
          parseDate(b.last_inbound_date).getTime() -
          parseDate(a.last_inbound_date).getTime()
      )
      .map((data) => {
        return (
          <tr
            key={data.id}
            className={data.blocked ? styles["greyed-contact"] : ""}
          >
            <td className={styles["sender-number"]}>
              {formatPhone(data.inbound_number ?? "")}
            </td>
            <td
              className={`${styles["sender-date"]} ${styles["sender-date-wrapper"]}`}
            >
              {data.last_inbound_type === "text" && (
                <ForwardedTextIcon
                  alt="Last received a text"
                  className={styles["forwarded-type-icon"]}
                  width={20}
                  height={12}
                />
              )}
              {data.last_inbound_type === "call" && (
                <ForwardedCallIcon
                  alt="Last received a call"
                  className={styles["forwarded-type-icon"]}
                  width={20}
                  height={15}
                />
              )}
              {dateTimeFormatter.format(parseDate(data.last_inbound_date))}
            </td>
            <td className={styles["sender-controls"]}>
              <button
                onClick={() =>
                  inboundContactData.setForwardingState(!data.blocked, data.id)
                }
                className={styles["block-btn"]}
              >
                {data.blocked ? "Unblock" : "Block"}
              </button>
            </td>
          </tr>
        );
      });

  const senderLogsPanel = (
    <table className={styles["caller-sms-senders-table"]}>
      <thead>
        <tr className={styles["greyed-contact"]}>
          <th>{l10n.getString("phone-dashboard-sender-table-title-sender")}</th>
          <th>
            {l10n.getString("phone-dashboard-sender-table-title-activity")}
          </th>
          <th>{l10n.getString("phone-dashboard-sender-table-title-action")}</th>
        </tr>
      </thead>
      <tbody>{inboundContactArray}</tbody>
    </table>
  );

  return (
    <div id="secondary-panel" className={styles["dashboard-card"]}>
      <div className={styles["dashboard-card-caller-sms-senders-header"]}>
        <span>
          <button
            type="button"
            onClick={() => props.back_btn()}
            className={styles["caller-sms-logs-back-btn"]}
          >
            <ChevronLeftIcon
              alt="Back to Primary Dashboard"
              className={styles["nav-icon"]}
              width={20}
              height={20}
            />
          </button>
        </span>
        <span className={styles["caller-sms-logs-title"]}>
          {l10n.getString("phone-dashboard-senders-header")}
        </span>
        <span></span>
      </div>
      {props.type === "primary" && <>{senderLogsPanel}</>}
      {props.type === "disabled" && <>{disabledCallerSMSSendersPanel}</>}
      {props.type === "empty" && <>{emptyCallerSMSSendersPanel}</>}
    </div>
  );
};

/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { useRelayNumber } from "../../../hooks/api/relayNumber";
import styles from "./PhoneDashboard.module.scss";
import { CopyIcon, ForwardIcon, BlockIcon } from "../../../components/Icons";
import { MouseEventHandler, useState } from "react";

export const PhoneDashboard = () => {
  const relayNumberData = useRelayNumber();
  const [justCopiedApiKey, setJustCopiedPhoneNumber] = useState(false);

  const [enableForwarding, setEnableForwarding] = useState(true);
  const [blockForwarding, setBlockForwarding] = useState(false);

  const toggleForwarding = () => {
    setEnableForwarding(!enableForwarding);
    setBlockForwarding(!blockForwarding);
  };

  const copyPhoneNumber: MouseEventHandler<HTMLButtonElement> = () => {
    // TODO: Find a way to not have to use a non-null assertion operator here
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    navigator.clipboard.writeText(relayNumberData?.data?.[0].number!);
    setJustCopiedPhoneNumber(true);
    setTimeout(() => setJustCopiedPhoneNumber(false), 1000);
  };

  const phoneStatistics = (
    <div className={styles["phone-statistics-container"]}>
      <div className={styles["phone-statistics"]}>
        <p className={styles["phone-statistics-title"]}>12:04 min</p>
        <p className={styles["phone-statistics-body"]}>
          Remaining call minutes
        </p>
      </div>

      <div className={styles["phone-statistics"]}>
        <p className={styles["phone-statistics-title"]}>12:04 min</p>
        <p className={styles["phone-statistics-body"]}>
          Remaining call minutes
        </p>
      </div>

      <div className={styles["phone-statistics"]}>
        <p className={styles["phone-statistics-title"]}>12:04 min</p>
        <p className={styles["phone-statistics-body"]}>
          Remaining call minutes
        </p>
      </div>

      <div className={styles["phone-statistics"]}>
        <p className={styles["phone-statistics-title"]}>12:04 min</p>
        <p className={styles["phone-statistics-body"]}>
          Remaining call minutes
        </p>
      </div>
    </div>
  );

  const phoneControls = (
    <div className={styles["phone-controls-container"]}>
      <div className={styles["phone-controls"]}>
        <button
          onClick={toggleForwarding}
          className={
            enableForwarding ? styles["active-button"] : styles["base-button"]
          }
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
          className={
            blockForwarding ? styles["active-button"] : styles["base-button"]
          }
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
          <span>
            Relay is currently forwarding all phone calls and SMS messages to
            your true phone number.
          </span>
        ) : (
          <span>
            Relay is blocking all phone calls and text messages—you will not
            receive anything from your phone number mask.
          </span>
        )}
      </div>
    </div>
  );

  const phoneMetadata = (
    <div className={styles["metadata-container"]}>
      <dl>
        <div className={`${styles["forward-target"]} ${styles.metadata}`}>
          <dt>Forwarded to:</dt>
          <dd>Phone number</dd>
        </div>
        <div className={`${styles["date-created"]} ${styles.metadata}`}>
          <dt>Date Created:</dt>
          <dd>Date</dd>
        </div>
      </dl>
    </div>
  );

  return (
    <main>
      <div className={styles["dashboard-card"]}>
        {/* Phone dashboard comes here! Your Relay phone mask is{" "} */}
        {/* <samp>{relayNumberData.data?.[0]?.number ?? "still loading"}</samp>. */}
        <span className={styles["header-phone-number"]}>
          {relayNumberData.data?.[0]?.number}
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
                aria-hidden={!justCopiedApiKey}
                className={`${styles["copied-confirmation"]} ${
                  justCopiedApiKey ? styles["is-shown"] : ""
                }`}
              >
                Copied!
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

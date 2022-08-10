import { useRelayNumber } from "../../../hooks/api/relayNumber";
import styles from "./PhoneDashboard.module.scss";
import { CopyIcon } from "../../../components/Icons";
import { MouseEventHandler, useState } from "react";

export const PhoneDashboard = () => {
  const relayNumberData = useRelayNumber();
  const [justCopiedApiKey, setJustCopiedPhoneNumber] = useState(false);

  const copyPhoneNumber: MouseEventHandler<HTMLButtonElement> = () => {
    navigator.clipboard.writeText(relayNumberData.data?.[0]?.number);
    setJustCopiedPhoneNumber(true);
    setTimeout(() => setJustCopiedPhoneNumber(false), 1000);
  };

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

        <div className={styles["phone-data-cards-container"]}>
          <div className={styles["phone-data-card"]}>
            <p className={styles["phone-data-card-title"]}>12:04 min</p>
            <p className={styles["phone-data-card-body"]}>
              Remaining call minutes
            </p>
          </div>

          <div className={styles["phone-data-card"]}>
            <p className={styles["phone-data-card-title"]}>12:04 min</p>
            <p className={styles["phone-data-card-body"]}>
              Remaining call minutes
            </p>
          </div>

          <div className={styles["phone-data-card"]}>
            <p className={styles["phone-data-card-title"]}>12:04 min</p>
            <p className={styles["phone-data-card-body"]}>
              Remaining call minutes
            </p>
          </div>

          <div className={styles["phone-data-card"]}>
            <p className={styles["phone-data-card-title"]}>12:04 min</p>
            <p className={styles["phone-data-card-body"]}>
              Remaining call minutes
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

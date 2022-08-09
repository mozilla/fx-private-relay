import { useRelayNumber } from "../../../hooks/api/relayNumber";
import styles from "./PhoneDashboard.module.scss";

export const PhoneDashboard = () => {
  const relayNumberData = useRelayNumber();

  return (
    <main>
      <div className={styles["dashboard-card"]}>
        {/* Phone dashboard comes here! Your Relay phone mask is{" "} */}
        {/* <samp>{relayNumberData.data?.[0]?.number ?? "still loading"}</samp>. */}
        <p className={styles["header-phone-number"]}>
          {relayNumberData.data?.[0]?.number}
        </p>

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

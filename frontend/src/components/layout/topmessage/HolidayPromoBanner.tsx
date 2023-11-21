import Link from "next/link";
import { useL10n } from "../../../hooks/l10n";
import { Localized } from "../../Localized";
import styles from "./HolidayPromoBanner.module.scss";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import {
  RuntimeDataWithPeriodicalPremiumAvailable,
  getPeriodicalPremiumSubscribeLink,
} from "../../../functions/getPlan";
type Props = {
  runtimeData?: RuntimeData;
};

export const HolidayPromoBanner = (props: Props) => {
  const l10n = useL10n();
  const coupon = "HOLIDAY2023";
  const subscribeLink = getPeriodicalPremiumSubscribeLink(
    props.runtimeData as RuntimeDataWithPeriodicalPremiumAvailable,
    "yearly",
  );
  const subscriberLinkWithCoupon = `${subscribeLink}&coupon=${coupon}`;

  return (
    <aside className={styles.wrapper}>
      <div className={styles["left-promo-container"]}>
        <div className={styles["promo-container"]}>
          <Localized
            id="holiday-promo-banner-desc"
            elems={{
              promo: (
                <span
                  className={`${styles["promo-text-bolded"]} ${styles["promo-desc"]}`}
                />
              ),
            }}
          >
            <p className={styles["promo-text"]} />
          </Localized>
        </div>
        <div className={styles["promo-container"]}>
          <Localized
            id="holiday-promo-banner-code-desc"
            vars={{ coupon_code: coupon }}
            elems={{
              coupon: <span className={styles["promo-text-bolded"]} />,
            }}
          >
            <p className={styles["promo-text"]} />
          </Localized>
        </div>
      </div>
      <div className={styles["promo-container"]}>
        <Link href={subscriberLinkWithCoupon} className={styles["cta-button"]}>
          {l10n.getString("holiday-promo-banner-cta-button")}
        </Link>
        <p className={styles["promo-code-expiry"]}>
          {l10n.getString("holiday-promo-banner-promo-expiry")}
        </p>
      </div>
    </aside>
  );
};

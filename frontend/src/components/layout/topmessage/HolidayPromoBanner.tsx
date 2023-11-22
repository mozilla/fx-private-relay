import Link from "next/link";
import { useL10n } from "../../../hooks/l10n";
import { Localized } from "../../Localized";
import styles from "./HolidayPromoBanner.module.scss";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import {
  getPeriodicalPremiumSubscribeLink,
  isPeriodicalPremiumAvailableInCountry,
} from "../../../functions/getPlan";
type Props = {
  runtimeData?: RuntimeData;
};

export const HolidayPromoBanner = (props: Props) => {
  const l10n = useL10n();
  const coupon = "HOLIDAY20";
  const couponExpiry = "Dec 31, 2023";
  const subscribeLink = isPeriodicalPremiumAvailableInCountry(props.runtimeData)
    ? getPeriodicalPremiumSubscribeLink(props.runtimeData, "yearly")
    : null;
  if (!subscribeLink) {
    return null;
  }
  const subscriberLinkWithCoupon = `${subscribeLink}&coupon=${coupon}`;

  return (
    <aside className={styles.wrapper}>
      <div className={styles["left-promo-container"]}>
        <div className={styles["promo-container"]}>
          <p className={styles["promo-text"]}>
            {l10n.getString("holiday-promo-banner-protect-inbox")}
          </p>
          <p className={styles["promo-text-bolded"]}>
            {l10n.getString("holiday-promo-banner-code-desc")}
          </p>
        </div>
        <div className={styles["promo-container"]}>
          <Localized
            id="holiday-promo-banner-code-usage"
            vars={{ couponCode: coupon }}
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
          {l10n.getString("holiday-promo-banner-promo-expiry", {
            couponExpiryDate: couponExpiry,
          })}
        </p>
      </div>
    </aside>
  );
};

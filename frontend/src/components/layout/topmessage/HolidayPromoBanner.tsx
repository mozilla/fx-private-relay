import Link from "next/link";
import { useRouter } from "next/router";
import { useL10n } from "../../../hooks/l10n";
import { Localized } from "../../Localized";
import styles from "./HolidayPromoBanner.module.scss";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import {
  getPeriodicalPremiumSubscribeLink,
  isPeriodicalPremiumAvailableInCountry,
} from "../../../functions/getPlan";
import { ProfileData } from "../../../hooks/api/profile";
import { event as gaEvent } from "react-ga";
import { useGaViewPing } from "../../../hooks/gaViewPing";

type Props = {
  isLoading: boolean;
  profile?: ProfileData;
  runtimeData?: RuntimeData;
};

export const HolidayPromoBanner = (props: Props) => {
  const l10n = useL10n();
  const router = useRouter();
  const coupon = "HOLIDAY20";
  const subscribeLink = isPeriodicalPremiumAvailableInCountry(props.runtimeData)
    ? getPeriodicalPremiumSubscribeLink(props.runtimeData, "yearly")
    : null;
  const todaysDate = new Date();
  const expiryDate = new Date("December 31, 2023");
  const isPastExpiry = todaysDate > expiryDate;
  const gaHolidayBannerViewPing = useGaViewPing({
    category: "Holiday Promotion Banner 2023",
    label: "holiday-promo-banner-view",
  });
  const gaHolidayBannerBtnPing = () => {
    gaEvent({
      category: "Holiday Promotion Banner 2023",
      action: "Engage",
      label: "holiday-promo-banner-get-one-year-btn",
    });
  };

  if (
    props.isLoading ||
    !subscribeLink ||
    (props.profile && router.pathname !== "/premium") ||
    isPastExpiry
  ) {
    return null;
  }

  const utmParams =
    "&utm_source=fx-relay&utm_medium=banner&utm_content=holiday-promo-banner-cta&utm_campaign=relay-holiday-promo-2023";
  const subscriberLinkWithCoupon = `${subscribeLink}&coupon=${coupon}${utmParams}`;

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
        <Link
          ref={gaHolidayBannerViewPing}
          onClick={gaHolidayBannerBtnPing}
          href={subscriberLinkWithCoupon}
          className={styles["cta-button"]}
        >
          {l10n.getString("holiday-promo-banner-cta-button")}
        </Link>
        <small className={styles["promo-code-expiry"]}>
          {l10n.getString("holiday-promo-banner-promo-expiry")}
        </small>
      </div>
    </aside>
  );
};

import { useLocalization } from "@fluent/react";
import { ReactNode } from "react";
import styles from "./ProfileBanners.module.scss";
import PhoneIllustration from "./images/phone-premium-promo.svg";
import { Banner } from "../Banner";

export const PremiumPromoBanners = () => {
  const banners: ReactNode[] = [];

  banners.push(<StopSpamBanner key="stop-spam-premium-banner" />);
  banners.push(
    <AdvancedIdentityBanner key="advanced-identity-premium-banner" />
  );
  banners.push(<ControlReceiverBanner key="control-receiver-premium-banner" />);
  banners.push(<ExtraProtectionBanner key="extra-protection-premium-banner" />);

  return <div className={styles["profile-banners"]}>{banners}</div>;
};

const phoneImage = <img src={PhoneIllustration.src} alt="" />;

const StopSpamBanner = () => {
  const { l10n } = useLocalization();

  return (
    <Banner
      type="promo"
      title={l10n.getString("banner-ab-premium-promo-stop-spam-headline")}
      illustration={{
        img: phoneImage,
        type: "flex-end",
      }}
      cta={{
        size: "large",
        target: "/premium/pricing",
        content: l10n.getString("banner-ab-premium-promo-cta"),
      }}
    >
      <p>{l10n.getString("banner-ab-premium-promo-stop-spam-body")}</p>
    </Banner>
  );
};

const AdvancedIdentityBanner = () => {
  const { l10n } = useLocalization();

  return (
    <Banner
      type="promo"
      title={l10n.getString(
        "banner-ab-premium-promo-advanced-identity-headline"
      )}
      illustration={{
        img: phoneImage,
        type: "flex-end",
      }}
      cta={{
        size: "large",
        target: "/premium/pricing",
        content: l10n.getString("banner-ab-premium-promo-cta"),
      }}
    >
      <p>{l10n.getString("banner-ab-premium-promo-advanced-identity-body")}</p>
    </Banner>
  );
};

const ControlReceiverBanner = () => {
  const { l10n } = useLocalization();

  return (
    <Banner
      type="promo"
      title={l10n.getString(
        "banner-ab-premium-promo-control-receiver-headline"
      )}
      illustration={{
        img: phoneImage,
        type: "flex-end",
      }}
      cta={{
        size: "large",
        target: "/premium/pricing",
        content: l10n.getString("banner-ab-premium-promo-cta"),
      }}
    >
      <p>{l10n.getString("banner-ab-premium-promo-control-receiver-body")}</p>
    </Banner>
  );
};

const ExtraProtectionBanner = () => {
  const { l10n } = useLocalization();

  return (
    <Banner
      type="promo"
      title={l10n.getString(
        "banner-ab-premium-promo-extra-protection-headline"
      )}
      illustration={{
        img: phoneImage,
        type: "flex-end",
      }}
      cta={{
        size: "large",
        target: "/premium/pricing",
        content: l10n.getString("banner-ab-premium-promo-cta"),
      }}
    >
      <p>{l10n.getString("banner-ab-premium-promo-extra-protection-body")}</p>
    </Banner>
  );
};

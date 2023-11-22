import { ReactNode } from "react";
import { event as gaEvent } from "react-ga";

import Image from "next/image";
import styles from "./ProfileBanners.module.scss";
import PhoneIllustration from "./images/phone-premium-promo.svg";
import { Banner } from "../Banner";
import { useL10n } from "../../hooks/l10n";
import { ProfileData } from "../../hooks/api/profile";

export type Props = {
  showFirstPremiumBanner?: boolean;
  profile: ProfileData;
};

export const PremiumPromoBanners = (props: Props) => {
  const banners: ReactNode[] = [];

  // Only show the first banner while waiting for the A/B test architecture to be built out
  {
    props.showFirstPremiumBanner
      ? banners.push(
          <StopSpamBanner
            profileData={props.profile}
            key="stop-spam-premium-banner"
          />,
        )
      : null;
  }

  // TODO: Implement A/B architecture to following banners
  // banners.push(<StopSpamBanner key="stop-spam-premium-banner" />);
  //   banners.push(
  //     <AdvancedIdentityBanner key="advanced-identity-premium-banner" />
  //   );
  //   banners.push(
  //     <ControlReceiverBanner key="control-receiver-premium-banner" />
  //   );
  //   banners.push(
  //     <ExtraProtectionBanner key="extra-protection-premium-banner" />);

  return <div className={styles["profile-banners"]}>{banners}</div>;
};

const phoneImage = <Image src={PhoneIllustration} alt="" />;

type StopSpamBannerProps = {
  profileData: ProfileData;
};

const StopSpamBanner = (props: StopSpamBannerProps) => {
  const l10n = useL10n();

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
        target: "/premium#pricing",
        content: l10n.getString("banner-ab-premium-promo-cta"),
        gaViewPing: {
          category: "Purchase button",
          label: "premium-promo-stop-spam",
        },
        onClick: () => {
          gaEvent({
            category: "Purchase button",
            action: "Engage",
            label: "premium-promo-stop-spam",
          });
        },
      }}
      dismissal={{
        key: `stop-spam-banner-${props.profileData.id}`,
      }}
    >
      <p>{l10n.getString("banner-ab-premium-promo-stop-spam-body")}</p>
    </Banner>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AdvancedIdentityBanner = () => {
  const l10n = useL10n();

  return (
    <Banner
      type="promo"
      title={l10n.getString(
        "banner-ab-premium-promo-advanced-identity-headline",
      )}
      illustration={{
        img: phoneImage,
        type: "flex-end",
      }}
      cta={{
        size: "large",
        target: "/premium#pricing",
        content: l10n.getString("banner-ab-premium-promo-cta"),
        gaViewPing: {
          category: "Purchase button",
          label: "premium-promo-advanced-identity",
        },
        onClick: () => {
          gaEvent({
            category: "Purchase button",
            action: "Engage",
            label: "premium-promo-advanced-identity",
          });
        },
      }}
    >
      <p>{l10n.getString("banner-ab-premium-promo-advanced-identity-body")}</p>
    </Banner>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ControlReceiverBanner = () => {
  const l10n = useL10n();

  return (
    <Banner
      type="promo"
      title={l10n.getString(
        "banner-ab-premium-promo-control-receiver-headline",
      )}
      illustration={{
        img: phoneImage,
        type: "flex-end",
      }}
      cta={{
        size: "large",
        target: "/premium#pricing",
        content: l10n.getString("banner-ab-premium-promo-cta"),
        gaViewPing: {
          category: "Purchase button",
          label: "premium-promo-control-receiver",
        },
        onClick: () => {
          gaEvent({
            category: "Purchase button",
            action: "Engage",
            label: "premium-promo-control-receiver",
          });
        },
      }}
    >
      <p>{l10n.getString("banner-ab-premium-promo-control-receiver-body")}</p>
    </Banner>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ExtraProtectionBanner = () => {
  const l10n = useL10n();

  return (
    <Banner
      type="promo"
      title={l10n.getString(
        "banner-ab-premium-promo-extra-protection-headline",
      )}
      illustration={{
        img: phoneImage,
        type: "flex-end",
      }}
      cta={{
        size: "large",
        target: "/premium#pricing",
        content: l10n.getString("banner-ab-premium-promo-cta"),
        gaViewPing: {
          category: "Purchase button",
          label: "premium-promo-extra-protection",
        },
        onClick: () => {
          gaEvent({
            category: "Purchase button",
            action: "Engage",
            label: "premium-promo-extra-protection",
          });
        },
      }}
    >
      <p>{l10n.getString("banner-ab-premium-promo-extra-protection-body")}</p>
    </Banner>
  );
};

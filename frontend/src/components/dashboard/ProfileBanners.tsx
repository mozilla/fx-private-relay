import { ReactNode } from "react";
import Image from "next/image";
import styles from "./ProfileBanners.module.scss";
import FirefoxLogo from "./images/fx-logo.svg";
import BundleLogo from "./images/vpn-and-relay-logo.svg";
import AddonIllustration from "./images/banner-addon.svg";
import RelayLogo from "./images/placeholder-logo.svg";
import {
  getBundlePrice,
  getPeriodicalPremiumPrice,
  isBundleAvailableInCountry,
  isPeriodicalPremiumAvailableInCountry,
  isPhonesAvailableInCountry,
  RuntimeDataWithBundleAvailable,
  RuntimeDataWithPeriodicalPremiumAvailable,
} from "../../functions/getPlan";
import {
  isUsingFirefox,
  supportsChromeExtension,
  supportsFirefoxExtension,
} from "../../functions/userAgent";
import { ProfileData } from "../../hooks/api/profile";
import { UserData } from "../../hooks/api/user";
import { RuntimeData } from "../../../src/hooks/api/runtimeData";
import { Banner } from "../Banner";
import { renderDate } from "../../functions/renderDate";
import { SubdomainPicker } from "./SubdomainPicker";
import { useMinViewportWidth } from "../../hooks/mediaQuery";
import { AliasData } from "../../hooks/api/aliases";
import { PremiumPromoBanners } from "./PremiumPromoBanners";
import { useL10n } from "../../hooks/l10n";

export type Props = {
  profile: ProfileData;
  user: UserData;
  onCreateSubdomain: (chosenSubdomain: string) => Promise<void>;
  runtimeData?: RuntimeData;
  aliases: AliasData[];
};

/**
 * Displays relevant banners for on the user's profile page.
 *
 * Examples are:
 * - A banner to download Firefox if you're not on Firefox.
 * - A banner to download the add-on if you don't have it.
 * - A banner to upgrade to Premium if you don't have it but can purchase it.
 * - A banner to inform the user of emails that failed to be delivered.
 * - Anything else we might come up with in the future.
 *
 * See also {@link Banner}.
 */
export const ProfileBanners = (props: Props) => {
  const banners: ReactNode[] = [];
  const isLargeScreen = useMinViewportWidth("md");

  const bounceStatus = props.profile.bounce_status;
  if (bounceStatus[0]) {
    banners.push(
      <BounceBanner
        key="bounce-banner"
        email={props.user.email}
        profile={props.profile}
      />
    );
  }

  if (isBundleAvailableInCountry(props.runtimeData) && !props.profile.has_vpn) {
    banners.push(
      <BundlePromoBanner
        key="bundle-promo"
        runtimeData={props.runtimeData}
        profileData={props.profile}
      />
    );
  }

  banners.push(
    <SubdomainPicker
      key="subdomain-picker"
      profile={props.profile}
      onCreate={props.onCreateSubdomain}
    />
  );

  // Don't show the "Get Firefox" banner if we have an extension available,
  // to avoid banner overload:
  if (!isUsingFirefox() && (!supportsChromeExtension() || !isLargeScreen)) {
    banners.push(<NoFirefoxBanner key="firefox-banner" />);
  }

  if (supportsFirefoxExtension() && isLargeScreen) {
    // This pushes a banner promoting the add-on - detecting the add-on
    // and determining whether to show it based on that is a bit slow,
    // so we'll just let the add-on hide it:
    banners.push(<NoAddonBanner key="addon-banner" />);
  }

  if (supportsChromeExtension() && isLargeScreen) {
    // This pushes a banner promoting the add-on - detecting the add-on
    // and determining whether to show it based on that is a bit slow,
    // so we'll just let the add-on hide it:
    banners.push(<NoChromeExtensionBanner key="chrome-extension-banner" />);
  }

  if (
    !props.profile.has_premium &&
    isPeriodicalPremiumAvailableInCountry(props.runtimeData) &&
    props.aliases.length > 0
  ) {
    // Only show updated Premium Banners to users in US/CAN
    {
      isPhonesAvailableInCountry(props.runtimeData)
        ? banners.push(<PremiumPromoBanners showFirstPremiumBanner={true} />)
        : banners.push(
            <LoyalistPremiumBanner
              key="premium-banner"
              runtimeData={props.runtimeData}
            />
            // <NoPremiumBanner key="premium-banner" runtimeData={props.runtimeData} />
          );
    }
  }

  return <div className={styles["profile-banners"]}>{banners}</div>;
};

type BounceBannerProps = {
  email: string;
  profile: ProfileData;
};
const BounceBanner = (props: BounceBannerProps) => {
  const l10n = useL10n();

  return (
    <Banner type="warning" title={l10n.getString("banner-bounced-headline")}>
      {l10n.getFragment("banner-bounced-copy", {
        vars: {
          username: props.email,
          bounce_type: props.profile.bounce_status[1],
          date: renderDate(props.profile.next_email_try, l10n),
        },
        elems: {
          em: <em />,
        },
      })}
    </Banner>
  );
};

const NoFirefoxBanner = () => {
  const l10n = useL10n();

  return (
    <Banner
      type="promo"
      title={l10n.getString("banner-download-firefox-headline")}
      illustration={{
        img: <Image src={FirefoxLogo} alt="" width={60} height={60} />,
      }}
      cta={{
        target:
          "https://www.mozilla.org/firefox/new/?utm_source=fx-relay&utm_medium=banner&utm_campaign=download-fx",
        content: l10n.getString("banner-download-firefox-cta"),
      }}
    >
      <p>{l10n.getString("banner-download-firefox-copy-2")}</p>
    </Banner>
  );
};

const NoAddonBanner = () => {
  const l10n = useL10n();

  return (
    <Banner
      type="promo"
      title={l10n.getString("banner-download-install-extension-headline")}
      illustration={{
        img: <Image src={AddonIllustration} alt="" width={60} height={60} />,
      }}
      cta={{
        target:
          "https://addons.mozilla.org/firefox/addon/private-relay/?utm_source=fx-relay&utm_medium=banner&utm_campaign=install-addon",
        content: l10n.getString("banner-download-install-extension-cta"),
      }}
      hiddenWithAddon={true}
    >
      <p>{l10n.getString("banner-download-install-extension-copy-2")}</p>
    </Banner>
  );
};

const NoChromeExtensionBanner = () => {
  const l10n = useL10n();

  return (
    <Banner
      type="promo"
      title={l10n.getString(
        "banner-download-install-chrome-extension-headline"
      )}
      illustration={{
        img: <Image src={AddonIllustration} alt="" width={60} height={60} />,
      }}
      cta={{
        target:
          "https://chrome.google.com/webstore/detail/firefox-relay/lknpoadjjkjcmjhbjpcljdednccbldeb?utm_source=fx-relay&utm_medium=banner&utm_campaign=install-addon",
        content: l10n.getString("banner-download-install-chrome-extension-cta"),
      }}
      hiddenWithAddon={true}
    >
      <p>{l10n.getString("banner-download-install-chrome-extension-copy-2")}</p>
    </Banner>
  );
};

type NoPremiumBannerProps = {
  runtimeData: RuntimeDataWithPeriodicalPremiumAvailable;
};

type BundleBannerProps = {
  runtimeData: RuntimeDataWithBundleAvailable;
  profileData: ProfileData;
};

// Unused but left in for when we no longer want to use <LoyalistPremiumBanner>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NoPremiumBanner = (props: NoPremiumBannerProps) => {
  const l10n = useL10n();

  return (
    <Banner
      key="premium-banner"
      type="promo"
      title={l10n.getString("banner-upgrade-headline")}
      illustration={{
        img: <Image src={RelayLogo} alt="" width={60} height={60} />,
      }}
      cta={{
        target: "/premium#pricing",
        content: l10n.getString("banner-upgrade-cta"),
        gaViewPing: {
          category: "Purchase Button",
          label: "profile-banner-promo",
        },
      }}
    >
      <p>{l10n.getString("banner-upgrade-copy-2")}</p>
    </Banner>
  );
};

const LoyalistPremiumBanner = (props: NoPremiumBannerProps) => {
  const l10n = useL10n();

  return (
    <Banner
      key="premium-banner"
      type="promo"
      title={l10n.getString("banner-upgrade-loyalist-headline-2")}
      illustration={{
        img: <Image src={FirefoxLogo} alt="" width={60} height={60} />,
      }}
      cta={{
        size: "large",
        target: "/premium#pricing",
        content: l10n.getString("banner-upgrade-loyalist-cta"),
        gaViewPing: {
          category: "Purchase Button",
          label: "profile-banner-loyalist-promo",
        },
      }}
    >
      <p>
        {l10n.getString("banner-upgrade-loyalist-copy-2", {
          monthly_price: getPeriodicalPremiumPrice(
            props.runtimeData,
            "yearly",
            l10n
          ),
        })}
      </p>
    </Banner>
  );
};

const BundlePromoBanner = (props: BundleBannerProps) => {
  const l10n = useL10n();

  return (
    <Banner
      key="bundle-banner"
      type="promo"
      illustration={{
        img: (
          <Image
            src={BundleLogo}
            alt=""
            width={120}
            height={60}
            className={styles["bundle-logo"]}
          />
        ),
      }}
      title={l10n.getString("bundle-banner-dashboard-header")}
      cta={{
        target: "/premium#pricing",
        size: "large",
        content: l10n.getString("bundle-banner-dashboard-upgrade-cta"),
      }}
      dismissal={{
        key: `bundle-promo-banner-${props.profileData.id}`,
      }}
    >
      <p>
        {l10n.getString("bundle-banner-dashboard-body", {
          savings: "40%",
          monthly_price: getBundlePrice(props.runtimeData, l10n),
        })}
      </p>
    </Banner>
  );
};

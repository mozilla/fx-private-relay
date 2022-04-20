import { Localized, useLocalization } from "@fluent/react";
import { ReactNode } from "react";
import styles from "./ProfileBanners.module.scss";
import FirefoxLogo from "../../../../static/images/logos/fx-logo.svg";
import AddonIllustration from "../../../../static/images/banner-addon.svg";
import RelayLogo from "../../../../static/images/placeholder-logo.svg";
import {
  getPremiumSubscribeLink,
  isPremiumAvailableInCountry,
  RuntimeDataWithPremiumAvailable,
} from "../../functions/getPlan";
import {
  isUsingFirefox,
  supportsChromeExtension,
  supportsFirefoxExtension,
} from "../../functions/userAgent";
import { ProfileData } from "../../hooks/api/profile";
import { UserData } from "../../hooks/api/user";
import { RuntimeData } from "../../hooks/api/runtimeData";
import { Banner } from "../Banner";
import { trackPurchaseStart } from "../../functions/trackPurchase";
import { renderDate } from "../../functions/renderDate";
import { SubdomainPicker } from "./SubdomainPicker";
import { useMinViewportWidth } from "../../hooks/mediaQuery";
import { AliasData } from "../../hooks/api/aliases";

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
    isPremiumAvailableInCountry(props.runtimeData) &&
    props.aliases.length > 0
  ) {
    banners.push(
      <NoPremiumBanner key="premium-banner" runtimeData={props.runtimeData} />
    );
  }

  return <div className={styles["profile-banners"]}>{banners}</div>;
};

type BounceBannerProps = {
  email: string;
  profile: ProfileData;
};
const BounceBanner = (props: BounceBannerProps) => {
  const { l10n } = useLocalization();

  return (
    <Banner type="warning" title={l10n.getString("banner-bounced-headline")}>
      <Localized
        id="banner-bounced-copy"
        vars={{
          username: props.email,
          bounce_type: props.profile.bounce_status[1],
          date: renderDate(props.profile.next_email_try, l10n),
        }}
        elems={{
          em: <em />,
        }}
      >
        <p />
      </Localized>
    </Banner>
  );
};

const NoFirefoxBanner = () => {
  const { l10n } = useLocalization();

  return (
    <Banner
      type="promo"
      title={l10n.getString("banner-download-firefox-headline")}
      illustration={<img src={FirefoxLogo.src} alt="" width={60} height={60} />}
      cta={{
        target:
          "https://www.mozilla.org/firefox/new/?utm_source=fx-relay&utm_medium=banner&utm_campaign=download-fx",
        content: l10n.getString("banner-download-firefox-cta"),
      }}
    >
      <p>{l10n.getString("banner-download-firefox-copy")}</p>
    </Banner>
  );
};

const NoAddonBanner = () => {
  const { l10n } = useLocalization();

  return (
    <Banner
      type="promo"
      title={l10n.getString("banner-download-install-extension-headline")}
      illustration={
        <img src={AddonIllustration.src} alt="" width={60} height={60} />
      }
      cta={{
        target:
          "https://addons.mozilla.org/firefox/addon/private-relay/?utm_source=fx-relay&utm_medium=banner&utm_campaign=install-addon",
        content: l10n.getString("banner-download-install-extension-cta"),
      }}
      hiddenWithAddon={true}
    >
      <p>{l10n.getString("banner-download-install-extension-copy")}</p>
    </Banner>
  );
};

const NoChromeExtensionBanner = () => {
  const { l10n } = useLocalization();

  return (
    <Banner
      type="promo"
      title={l10n.getString(
        "banner-download-install-chrome-extension-headline"
      )}
      illustration={
        <img src={AddonIllustration.src} alt="" width={60} height={60} />
      }
      cta={{
        target:
          "https://chrome.google.com/webstore/detail/firefox-relay/lknpoadjjkjcmjhbjpcljdednccbldeb?utm_source=fx-relay&utm_medium=banner&utm_campaign=install-addon",
        content: l10n.getString("banner-download-install-chrome-extension-cta"),
      }}
      hiddenWithAddon={true}
    >
      <p>{l10n.getString("banner-download-install-chrome-extension-copy")}</p>
    </Banner>
  );
};

type NoPremiumBannerProps = {
  runtimeData: RuntimeDataWithPremiumAvailable;
};
const NoPremiumBanner = (props: NoPremiumBannerProps) => {
  const { l10n } = useLocalization();

  return (
    <Banner
      key="premium-banner"
      type="promo"
      title={l10n.getString("banner-upgrade-headline")}
      illustration={<img src={RelayLogo.src} alt="" width={60} height={60} />}
      cta={{
        target: getPremiumSubscribeLink(props.runtimeData),
        content: l10n.getString("banner-upgrade-cta"),
        onClick: () => trackPurchaseStart(),
        gaViewPing: {
          category: "Purchase Button",
          label: "profile-banner-promo",
        },
      }}
    >
      <p>{l10n.getString("banner-upgrade-copy")}</p>
    </Banner>
  );
};

import { ReactNode } from "react";

import styles from "./ProfileBanners.module.scss";
import FirefoxLogo from "./images/fx-logo.svg";
import AddonIllustration from "./images/banner-addon.svg";
import {
  isUsingFirefox,
  supportsFirefoxExtension,
} from "../../functions/userAgent";
import { ProfileData } from "../../hooks/api/profile";
import { UserData } from "../../hooks/api/user";
import { RuntimeData } from "../../hooks/api/types";
import { Banner } from "../Banner";
import Image from "../Image";
import { renderDate } from "../../functions/renderDate";
import { SubdomainPicker } from "./SubdomainPicker";
import { useMinViewportWidth } from "../../hooks/mediaQuery";
import { AliasData } from "../../hooks/api/aliases";
import { useGaEvent } from "../../hooks/gaEvent";
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
      />,
    );
  }

  banners.push(
    <SubdomainPicker
      key="subdomain-picker"
      profile={props.profile}
      onCreate={props.onCreateSubdomain}
    />,
  );

  // Don't show the "Get Firefox" banner if we have an extension available,
  // to avoid banner overload:
  if (!isUsingFirefox() || !isLargeScreen) {
    banners.push(<NoFirefoxBanner key="firefox-banner" />);
  }

  if (
    supportsFirefoxExtension() &&
    isLargeScreen &&
    // This identifies mock data used for demonstration purposes.
    // See /frontend/__mocks__/api/mockData.ts:
    props.profile.api_token !== "demo"
  ) {
    // This pushes a banner promoting the add-on - detecting the add-on
    // and determining whether to show it based on that is a bit slow,
    // so we'll just let the add-on hide it:
    banners.push(
      <NoAddonBanner profileData={props.profile} key="addon-banner" />,
    );
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
  const gaEvent = useGaEvent();

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
        size: "large",
        gaViewPing: {
          category: "Download Firefox",
          label: "profile-banner-download-firefox",
        },
        onClick: () => {
          gaEvent({
            category: "Download Firefox",
            action: "Engage",
            label: "profile-banner-download-firefox",
          });
        },
      }}
    >
      <p>{l10n.getString("banner-download-firefox-copy-2")}</p>
    </Banner>
  );
};

type NoAddonBannerProps = {
  profileData: ProfileData;
};

const NoAddonBanner = (props: NoAddonBannerProps) => {
  const l10n = useL10n();
  const gaEvent = useGaEvent();

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
        size: "large",
        gaViewPing: {
          category: "Download Extension",
          label: "profile-banner-download-firefox-extension",
        },
        onClick: () => {
          gaEvent({
            category: "Download Firefox",
            action: "Engage",
            label: "profile-banner-download-firefox-extension",
          });
        },
      }}
      dismissal={{
        key: `firefox-extension-banner-${props.profileData.id}`,
      }}
      hiddenWithAddon={true}
    >
      <p>{l10n.getString("banner-download-install-extension-copy-2")}</p>
    </Banner>
  );
};

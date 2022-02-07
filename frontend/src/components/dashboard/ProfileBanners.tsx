import { Localized, useLocalization } from "@fluent/react";
import { ReactNode } from "react";
import styles from "./ProfileBanners.module.scss";
import FirefoxLogo from "../../../../static/images/logos/fx-logo.svg";
import AddonIllustration from "../../../../static/images/banner-addon.svg";
import RelayLogo from "../../../../static/images/placeholder-logo.svg";
import {
  getPremiumSubscribeLink,
  isPremiumAvailableInCountry,
} from "../../functions/getPlan";
import { isUsingFirefox } from "../../functions/userAgent";
import { ProfileData } from "../../hooks/api/profile";
import { UserData } from "../../hooks/api/user";
import { RuntimeData } from "../../hooks/api/runtimeData";
import { Banner } from "../Banner";
import { trackPurchaseStart } from "../../functions/trackPurchase";
import { renderDate } from "../../functions/renderDate";

export type Props = {
  profile: ProfileData;
  user: UserData;
  runtimeData?: RuntimeData;
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
  const { l10n } = useLocalization();
  const banners: ReactNode[] = [];

  const bounceStatus = props.profile.bounce_status;
  if (bounceStatus[0]) {
    banners.push(
      <Banner
        key="bounce-banner"
        type="warning"
        title={l10n.getString("banner-bounced-headline")}
      >
        <Localized
          id="banner-bounced-copy"
          vars={{
            username: props.user.email,
            bounce_type: bounceStatus[1],
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
  }

  if (!isUsingFirefox()) {
    banners.push(
      <Banner
        key="firefox-banner"
        type="promo"
        title={l10n.getString("banner-download-firefox-headline")}
        illustration={
          <img src={FirefoxLogo.src} alt="" width={60} height={60} />
        }
        cta={{
          target:
            "https://www.mozilla.org/firefox/new/?utm_source=fx-relay&utm_medium=banner&utm_campaign=download-fx",
          content: l10n.getString("banner-download-firefox-cta"),
        }}
      >
        <p>{l10n.getString("banner-download-firefox-copy")}</p>
      </Banner>
    );
  }

  if (isUsingFirefox()) {
    // This pushes a banner promoting the add-on - detecting the add-on
    // and determining whether to show it based on that is a bit slow,
    // so we'll just let the add-on hide it:
    banners.push(
      <Banner
        key="addon-banner"
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
  }

  if (
    !props.profile.has_premium &&
    isPremiumAvailableInCountry(props.runtimeData)
  ) {
    banners.push(
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
  }

  return <div className={styles.profileBanners}>{banners}</div>;
};

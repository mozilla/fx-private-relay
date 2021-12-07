import { useLocalization } from "@fluent/react";
import { ReactNode } from "react";
import styles from "./ProfileBanners.module.scss";
import FirefoxLogo from "../../../../static/images/logos/fx-logo.svg";
import RelayLogo from "../../../../static/images/placeholder-logo.svg";
import {
  getPremiumSubscribeLink,
  isPremiumAvailableInCountry,
} from "../../functions/getPlan";
import { isUsingFirefox } from "../../functions/userAgent";
import { usePremiumCountries } from "../../hooks/api/premiumCountries";
import { ProfileData } from "../../hooks/api/profile";
import { Banner } from "../Banner";

export type Props = {
  profile: ProfileData;
};

export const ProfileBanners = (props: Props) => {
  const { l10n } = useLocalization();
  const premiumCountriesData = usePremiumCountries();
  const banners: ReactNode[] = [];

  if (!isUsingFirefox()) {
    banners.push(
      <Banner
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

  if (
    !props.profile.has_premium &&
    isPremiumAvailableInCountry(premiumCountriesData.data)
  ) {
    banners.push(
      <Banner
        type="promo"
        title={l10n.getString("banner-upgrade-headline")}
        illustration={<img src={RelayLogo.src} alt="" width={60} height={60} />}
        cta={{
          target: getPremiumSubscribeLink(premiumCountriesData.data),
          content: l10n.getString("banner-upgrade-cta"),
        }}
      >
        <p>{l10n.getString("banner-upgrade-copy")}</p>
      </Banner>
    );
  }

  return <div className={styles.profileBanners}>{banners}</div>;
};

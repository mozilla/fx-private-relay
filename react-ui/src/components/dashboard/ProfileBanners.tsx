import { useLocalization } from "@fluent/react";
import { ReactNode } from "react";
import RelayLogo from "../../../../static/images/placeholder-logo.svg";
import {
  getPremiumSubscribeLink,
  isPremiumAvailableInCountry,
} from "../../functions/getPlan";
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

  return <>{banners}</>;
};

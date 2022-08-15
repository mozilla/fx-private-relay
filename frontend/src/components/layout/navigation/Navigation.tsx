import Link from "next/link";
import { useRouter } from "next/router";
import { useLocalization } from "@fluent/react";
import styles from "./Navigation.module.scss";
import { SignUpButton } from "./SignUpButton";
import { SignInButton } from "./SignInButton";
import { ProfileData } from "../../../hooks/api/profile";
import { UpgradeButton } from "./UpgradeButton";
import { WhatsNewMenu } from "./whatsnew/WhatsNewMenu";
import { UserMenu } from "./UserMenu";
import { AppPicker } from "./AppPicker";
import { MenuToggle } from "./MenuToggle";
import { useRuntimeData } from "../../../hooks/api/runtimeData";
import { isPremiumAvailableInCountry } from "../../../functions/getPlan";
import { isFlagActive } from "../../../functions/waffle";

export type Props = {
  theme: "free" | "premium";
  hasPremium: boolean;
  mobileMenuExpanded: boolean | undefined;
  handleToggle: CallableFunction;
  profile: ProfileData | undefined;
  isLoggedIn: boolean;
};
/** Switch between the different pages of the Relay website. */
export const Navigation = (props: Props) => {
  const { l10n } = useLocalization();
  const runtimeData = useRuntimeData();
  const router = useRouter();
  const {
    theme,
    mobileMenuExpanded,
    handleToggle,
    profile,
    hasPremium,
    isLoggedIn,
  } = props;
  const homePath = isLoggedIn ? "/accounts/profile" : "/";
  const isPremiumPage = router.pathname === "/premium";

  const phoneLink =
    isLoggedIn && isFlagActive(runtimeData.data, "phones") ? (
      <Link href="/phone">
        <a
          className={`${styles.link} ${
            router.pathname === "/phone" ? styles["is-active"] : null
          }`}
        >
          {l10n.getString("nav-phone")}
        </a>
      </Link>
    ) : null;

  const ToggleButton = () => (
    <button
      className={styles["menu-toggle"]}
      aria-expanded={mobileMenuExpanded}
      onClick={() => handleToggle()}
    >
      {/* passing toggle state to show correct icon */}
      <MenuToggle toggleState={mobileMenuExpanded} />
    </button>
  );

  return (
    <nav className={styles["site-nav"]}>
      <Link href={homePath}>
        <a
          className={`${styles.link} ${styles["home-link"]} 
          ${styles["hidden-mobile"]} 
          ${router.pathname === homePath ? styles["is-active"] : ""}`}
        >
          {l10n.getString("nav-home")}
        </a>
      </Link>

      {phoneLink}

      <Link href="/faq">
        <a
          className={`${styles.link} ${styles["faq-link"]} 
          ${styles["hidden-mobile"]} 
          ${router.pathname === "/faq" ? styles["is-active"] : ""}`}
        >
          {l10n.getString("nav-faq")}
        </a>
      </Link>

      {/* if user is not logged in, show sign in and sign up buttons */}
      {!isLoggedIn && (
        <SignUpButton
          className={`${styles["sign-up-button"]} ${styles.link} ${styles["hidden-mobile"]}`}
        />
      )}
      {!isLoggedIn && (
        <SignInButton
          className={`${styles["sign-in-button"]} ${styles.link}`}
        />
      )}

      {/* if user is logged in and we have their profile data, show whatsnew menu */}
      {isLoggedIn && profile && (
        <WhatsNewMenu
          runtimeData={runtimeData.data}
          profile={profile}
          style={styles["hidden-mobile"]}
        />
      )}

      {/* Only show the upgrade button if the following conditions are met: 
        - if user is logged in
        - user does not have premium
        - user is NOT on the premium page /premium
        - premium is available in this country */}
      {isLoggedIn &&
        !hasPremium &&
        !isPremiumPage &&
        isPremiumAvailableInCountry(runtimeData.data) && <UpgradeButton />}

      <ToggleButton />

      <AppPicker theme={theme} style={styles["hidden-mobile"]} />

      <UserMenu style={styles["hidden-mobile"]} />
    </nav>
  );
};

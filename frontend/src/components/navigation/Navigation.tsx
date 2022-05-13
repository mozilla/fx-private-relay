import Link from "next/link";
import { useRouter } from "next/router";
import { useLocalization } from "@fluent/react";
import styles from "./Navigation.module.scss";
import { useIsLoggedIn } from "../../hooks/session";
import { SignUpButton } from "./SignUpButton";
import { SignInButton } from "./SignInButton";
import { useProfiles } from "../../hooks/api/profile";
import { UpgradeButton } from "./UpgradeButton";
import { WhatsNewMenu } from "../layout/whatsnew/WhatsNewMenu";
import { UserMenu } from "./UserMenu";
import { AppPicker } from "./AppPicker";
import { MenuToggle } from "./MenuToggle";

/** Switch between the different pages of the Relay website. */
export const Navigation = ({ ...props }) => {
  const { l10n } = useLocalization();
  const router = useRouter();
  const isLoggedIn = useIsLoggedIn();
  const profiles = useProfiles();
  const homePath = isLoggedIn ? "/accounts/profile" : "/";
  const hasPremium: boolean = profiles.data?.[0].has_premium || false;
  const { theme, mobileMenuState, toggle } = props;

  const ToggleButton = () => (
    <a
      href="#"
      className={styles["menu-toggle"]}
      role="menuitem"
      aria-controls="mobile-menu-toggle"
      aria-expanded={mobileMenuState}
      onClick={() => toggle()}
    >
      <MenuToggle toggle={mobileMenuState} />
    </a>
  );

  return (
    <nav aria-label={l10n.getString("nav-menu")} className={styles["site-nav"]}>
      <Link href={homePath}>
        <a
          className={`${styles.link} ${styles["home-link"]} ${
            router.pathname === homePath ? styles["is-active"] : null
          }`}
        >
          {l10n.getString("nav-home")}
        </a>
      </Link>

      <Link href="/faq">
        <a
          className={`${styles.link} ${styles["faq-link"]} ${
            router.pathname === "/faq" ? styles["is-active"] : null
          }`}
        >
          {l10n.getString("nav-faq")}
        </a>
      </Link>

      {/* if user is not logged in, show sign in and sign up buttons */}
      {!isLoggedIn && (
        <SignUpButton
          className={`${styles["sign-up-button"]} ${styles.link}`}
        />
      )}
      {!isLoggedIn && (
        <SignInButton
          className={`${styles["sign-in-button"]} ${styles.link}`}
        />
      )}

      {/* if user is logged in and we have their profile data, show whatsnew menu */}
      {isLoggedIn && profiles.data && (
        <WhatsNewMenu profile={profiles.data[0]} />
      )}

      {/* if user is logged in and doesn't have premium, show upgrade button */}
      {isLoggedIn && !hasPremium && <UpgradeButton />}

      <ToggleButton />

      <AppPicker theme={theme} />

      <UserMenu />
    </nav>
  );
};

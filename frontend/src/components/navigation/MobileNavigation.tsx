import Link from "next/link";
import { useRouter } from "next/router";
import { useLocalization } from "@fluent/react";
import styles from "./MobileNavigation.module.scss";
import { useIsLoggedIn } from "../../hooks/session";
import { SignUpButton } from "./SignUpButton";
import { SignInButton } from "./SignInButton";
import { useProfiles } from "../../hooks/api/profile";
import { UpgradeButton } from "./UpgradeButton";
import { WhatsNewMenu } from "../layout/whatsnew/WhatsNewMenu";
import {
  Cogwheel,
  DashboardIcon,
  FaqIcon,
  HomeIcon,
  Logout,
  MenuIcon,
  SignOutIcon,
  SupportIcon,
} from "../Icons";
import { UserMenu } from "./UserMenu";
import { AppPicker } from "./AppPicker";
import { MenuToggle } from "./MenuToggle";

/** Switch between the different pages of the Relay website. */
export const MobileNavigation = ({ ...props }) => {
  const { l10n } = useLocalization();
  const router = useRouter();
  const isLoggedIn = useIsLoggedIn();
  const profiles = useProfiles();
  const homePath = isLoggedIn ? "/accounts/profile" : "/";
  const hasPremium: boolean = profiles.data?.[0].has_premium || false;
  const { theme } = props;

  return (
    <nav
      aria-label={l10n.getString("nav-menu")}
      className={`${styles["mobile-menu"]} ${
        props.active ? styles["is-active"] : ""
      }`}
    >
      <ul>
        {!isLoggedIn && (
          <li className={`${styles["menu-item"]}`}>
            <Link href={homePath}>
              <a className={`${styles.link}`}>
                {HomeIcon({ alt: "home icon" })}
                {l10n.getString("nav-home")}
              </a>
            </Link>
          </li>
        )}
        {isLoggedIn && (
          <li className={`${styles["menu-item"]}`}>
            <Link href={homePath}>
              <a className={`${styles.link}`}>
                {DashboardIcon({ alt: "dashboard icon" })}
                {l10n.getString("nav-dashboard")}
              </a>
            </Link>
          </li>
        )}
        <li className={`${styles["menu-item"]}`}>
          <Link href="/faq">
            <a className={`${styles.link}`}>
              {FaqIcon({ alt: "home icon" })}
              {l10n.getString("nav-faq")}
            </a>
          </Link>
        </li>
        {!isLoggedIn && (
          <li className={`${styles["menu-item"]}`}>
            <SignUpButton className={`${styles["sign-up-button"]}`} />
          </li>
        )}
        {isLoggedIn && (
          <>
            <li className={`${styles["menu-item"]}`}>
              <Link href="/faq">
                <a className={`${styles.link}`}>
                  {Cogwheel()}
                  {l10n.getString("nav-settings")}
                </a>
              </Link>
            </li>
            <li className={`${styles["menu-item"]}`}>
              <Link href="/faq">
                <a className={`${styles.link}`}>
                  {SupportIcon({ alt: "Support icon" })}
                  {l10n.getString("nav-support")}
                </a>
              </Link>
            </li>
            <li className={`${styles["menu-item"]}`}>
              <Link href="/faq">
                <a className={`${styles.link}`}>
                  {SignOutIcon({ alt: "Sign out icon" })}
                  {l10n.getString("nav-sign-out")}
                </a>
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};
function CogIcon(arg0: { alt: string }): import("react").ReactNode {
  throw new Error("Function not implemented.");
}

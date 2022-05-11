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
  ContactIcon,
  DashboardIcon,
  FaqIcon,
  HomeIcon,
  NewTabIcon,
  SignOutIcon,
  SupportIcon,
} from "../Icons";
import { useUsers } from "../../hooks/api/user";
import { useRuntimeData } from "../../hooks/api/runtimeData";

/** Switch between the different pages of the Relay website. */
export const MobileNavigation = ({ ...props }) => {
  const { l10n } = useLocalization();
  const usersData = useUsers();
  const runtimeData = useRuntimeData();
  const isLoggedIn = useIsLoggedIn();
  const profiles = useProfiles();
  const homePath = isLoggedIn ? "/accounts/profile" : "/";
  const hasPremium: boolean = profiles.data?.[0].has_premium || false;
  const { theme } = props;

  if (
    !Array.isArray(usersData.data) ||
    usersData.data.length !== 1 ||
    !runtimeData.data
  ) {
    // Still fetching the user's account data...
    return null;
  }

  return (
    <nav
      aria-label={l10n.getString("nav-menu")}
      className={`${styles["mobile-menu"]} ${
        props.active ? styles["is-active"] : ""
      }`}
    >
      <ul className={`${styles["menu-item-list"]}`}>
        {isLoggedIn && (
          <li className={`${styles["menu-item"]}`}>
            <img
              //src={profiles.data?.[0].avatar}
              src="https://avatars.githubusercontent.com/u/3924990?v=4"
              alt={l10n.getString("nav-avatar")}
              className={styles["user-avatar"]}
              width={42}
              height={42}
            />
            <span>
              <b className={styles["user-email"]}>{usersData.data[0].email}</b>
              <a
                href={`${runtimeData.data.FXA_ORIGIN}/settings/`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles["settings-link"]}
              >
                {l10n.getString("nav-profile-manage-fxa")}
                <NewTabIcon />
              </a>
            </span>
          </li>
        )}

        {isLoggedIn && hasPremium && (
          <li className={`${styles["menu-item"]}`}>
            <Link href={homePath}>
              <a className={`${styles.link}`}>
                {ContactIcon({ alt: "contact icon" })}
                {l10n.getString("nav-contact")}
              </a>
            </Link>
          </li>
        )}

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

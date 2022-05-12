import Link from "next/link";
import { useLocalization } from "@fluent/react";
import styles from "./MobileNavigation.module.scss";
import { useIsLoggedIn } from "../../hooks/session";
import { SignUpButton } from "./SignUpButton";
import { useProfiles } from "../../hooks/api/profile";
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
import { getRuntimeConfig } from "../../config";

export type MenuItem = {
  url: string;
  alt: string;
  condition?: boolean;
  icon: any;
  l10n: string;
};

export const MobileNavigation = ({ ...props }) => {
  const { l10n } = useLocalization();
  const usersData = useUsers();
  const runtimeData = useRuntimeData();
  const isLoggedIn = useIsLoggedIn();
  const profiles = useProfiles();
  const hasPremium: boolean = profiles.data?.[0].has_premium || false;
  const { supportUrl } = getRuntimeConfig();

  if (
    !Array.isArray(usersData.data) ||
    usersData.data.length !== 1 ||
    !runtimeData.data
  ) {
    // Still fetching the user's account data...
    return null;
  }

  const renderMenuItem = (item: MenuItem) => {
    return item.condition || item.condition === undefined ? (
      <li className={`${styles["menu-item"]}`}>
        <Link href={item.url}>
          <a className={`${styles.link}`}>
            {item.icon({ alt: item.alt, width: 20, height: 20 })}
            {l10n.getString(item.l10n)}
          </a>
        </Link>
      </li>
    ) : null;
  };

  return (
    <nav
      aria-label={l10n.getString("nav-menu")}
      className={`${styles["mobile-menu"]} ${
        props.active ? styles["is-active"] : ""
      }`}
    >
      {/* Below we have conditional rendering of menu items  */}
      <ul className={`${styles["menu-item-list"]}`}>
        {isLoggedIn && (
          <li className={`${styles["menu-item"]}`}>
            <img
              src={profiles.data?.[0].avatar}
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

        {renderMenuItem({
          url: "/home",
          condition: isLoggedIn && hasPremium,
          alt: "contact icon",
          icon: ContactIcon,
          l10n: "nav-contact",
        })}

        {renderMenuItem({
          url: "/",
          alt: "home icon",
          condition: !isLoggedIn,
          icon: HomeIcon,
          l10n: "nav-home",
        })}

        {renderMenuItem({
          url: "/accounts/profile",
          alt: "dashboard icon",
          condition: isLoggedIn,
          icon: DashboardIcon,
          l10n: "nav-dashboard",
        })}

        {renderMenuItem({
          url: "/faq",
          alt: "FAQ icon",
          icon: FaqIcon,
          l10n: "nav-faq",
        })}

        {!isLoggedIn && (
          <li className={`${styles["menu-item"]}`}>
            <SignUpButton className={`${styles["sign-up-button"]}`} />
          </li>
        )}

        {renderMenuItem({
          url: "/accounts/settings",
          alt: "Settings",
          condition: isLoggedIn,
          icon: Cogwheel,
          l10n: "nav-settings",
        })}

        {renderMenuItem({
          url: supportUrl,
          alt: "Support",
          condition: isLoggedIn,
          icon: SupportIcon,
          l10n: "nav-support",
        })}

        {renderMenuItem({
          url: "/faq",
          alt: "Sign out",
          condition: isLoggedIn,
          icon: SignOutIcon,
          l10n: "nav-sign-out",
        })}
      </ul>
    </nav>
  );
};

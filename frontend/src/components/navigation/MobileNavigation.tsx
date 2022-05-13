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
import { getCsrfToken } from "../../functions/cookies";
import { useRef } from "react";

export type MenuItem = {
  url: string;
  condition?: boolean;
  icon: CallableFunction;
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
  const logoutFormRef = useRef<HTMLFormElement>(null);

  const renderMenuItem = (item: MenuItem) => {
    const { condition = true } = item;

    return condition ? (
      <li className={`${styles["menu-item"]}`}>
        <Link href={item.url}>
          <a className={`${styles.link}`}>
            {item.icon({
              alt: l10n.getString(item.l10n),
              width: 20,
              height: 20,
            })}
            {l10n.getString(item.l10n)}
          </a>
        </Link>
      </li>
    ) : null;
  };

  const handleSignOut = () => {
    logoutFormRef.current?.submit();
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
          <li className={`${styles["menu-item"]} ${styles["user-info"]}`}>
            <img
              src={profiles?.data?.[0].avatar}
              alt={l10n.getString("nav-avatar")}
              className={styles["user-avatar"]}
              width={42}
              height={42}
            />
            <span>
              <b className={styles["user-email"]}>
                {usersData.data ? usersData.data[0].email : ""}
              </b>
              <a
                href={`${runtimeData?.data?.FXA_ORIGIN}/settings/`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles["settings-link"]}
              >
                {l10n.getString("nav-profile-manage-fxa")}
                <NewTabIcon width={12} height={18} viewBox="0 0 16 18" />
              </a>
            </span>
          </li>
        )}

        {renderMenuItem({
          url: "/",
          condition: !isLoggedIn,
          icon: HomeIcon,
          l10n: "nav-home",
        })}

        {renderMenuItem({
          url: "/accounts/profile",
          condition: isLoggedIn,
          icon: DashboardIcon,
          l10n: "nav-dashboard",
        })}

        {/* omitting condition as this should always be visible */}
        {renderMenuItem({
          url: "/faq",
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
          condition: isLoggedIn,
          icon: Cogwheel,
          l10n: "nav-settings",
        })}

        {renderMenuItem({
          url: `${runtimeData?.data?.FXA_ORIGIN}/support/?utm_source=${
            getRuntimeConfig().frontendOrigin
          }`,
          condition: isLoggedIn && hasPremium,
          icon: ContactIcon,
          l10n: "nav-contact",
        })}

        {renderMenuItem({
          url: `${supportUrl}?utm_source=${getRuntimeConfig().frontendOrigin}`,
          condition: isLoggedIn,
          icon: SupportIcon,
          l10n: "nav-support",
        })}

        {isLoggedIn && (
          <li className={`${styles["menu-item"]}`}>
            <form
              method="POST"
              action={getRuntimeConfig().fxaLogoutUrl}
              ref={logoutFormRef}
            >
              <a className={`${styles.link}`} onClick={handleSignOut}>
                <input
                  type="hidden"
                  name="csrfmiddlewaretoken"
                  value={getCsrfToken()}
                />
                {SignOutIcon({
                  alt: l10n.getString("nav-sign-out"),
                  width: 20,
                  height: 20,
                })}
                {l10n.getString("nav-sign-out")}
              </a>
            </form>
          </li>
        )}
      </ul>
    </nav>
  );
};

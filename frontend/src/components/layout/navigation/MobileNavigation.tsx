import Link from "next/link";
import styles from "./MobileNavigation.module.scss";
import { SignUpButton } from "./SignUpButton";
import {
  Cogwheel,
  ContactIcon,
  FaqIcon,
  HomeIcon,
  MaskIcon,
  NewTabIcon,
  PhoneIcon,
  SignOutIcon,
  SupportIcon,
} from "../../Icons";
import { useRuntimeData } from "../../../hooks/api/runtimeData";
import { getRuntimeConfig } from "../../../config";
import { getCsrfToken } from "../../../functions/cookies";
import { useL10n } from "../../../hooks/l10n";

export type MenuItem = {
  url: string;
  isVisible?: boolean;
  icon: JSX.Element;
  l10n: string;
};

export type Props = {
  mobileMenuExpanded: boolean | undefined;
  hasPremium: boolean;
  isPhonesAvailable: boolean;
  isLoggedIn: boolean;
  userEmail: string | undefined;
  userAvatar: string | undefined;
};

export const MobileNavigation = (props: Props) => {
  const {
    mobileMenuExpanded,
    hasPremium,
    isLoggedIn,
    isPhonesAvailable,
    userEmail,
    userAvatar,
  } = props;
  const l10n = useL10n();
  const runtimeData = useRuntimeData();
  const { supportUrl } = getRuntimeConfig();

  const renderMenuItem = (item: MenuItem) => {
    const { isVisible = true } = item;

    return isVisible ? (
      <li className={`${styles["menu-item"]}`}>
        <Link href={item.url} className={`${styles.link}`}>
          {item.icon}
          {l10n.getString(item.l10n)}
        </Link>
      </li>
    ) : null;
  };

  // We make sure toggle state is not undefined
  // or we get a flash of the mobile menu on page load.
  const toggleMenuStateClass =
    typeof mobileMenuExpanded !== "boolean"
      ? ""
      : mobileMenuExpanded
      ? styles["is-active"]
      : styles["not-active"];

  return (
    <nav
      aria-label={l10n.getString("nav-menu-mobile")}
      className={`${styles["mobile-menu"]} ${toggleMenuStateClass}`}
    >
      {/* Below we have conditional rendering of menu items  */}
      <ul
        id={`${styles["mobile-menu"]}`}
        className={`${styles["menu-item-list"]} ${toggleMenuStateClass}`}
      >
        {isLoggedIn && (
          <li className={`${styles["menu-item"]} ${styles["user-info"]}`}>
            <img
              src={userAvatar ?? ""}
              alt=""
              className={styles["user-avatar"]}
              width={42}
              height={42}
            />
            <span>
              <b className={styles["user-email"]}>{userEmail ?? ""}</b>
              <a
                href={`${runtimeData?.data?.FXA_ORIGIN}/settings/`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles["settings-link"]}
              >
                {l10n.getString("nav-profile-manage-account")}
                <NewTabIcon width={12} height={18} viewBox="0 0 16 18" alt="" />
              </a>
            </span>
          </li>
        )}

        {renderMenuItem({
          url: "/",
          isVisible: !isLoggedIn,
          icon: <HomeIcon width={20} height={20} alt="" />,
          l10n: "nav-home",
        })}

        {renderMenuItem({
          url: "/accounts/profile",
          isVisible: isLoggedIn,
          icon: <MaskIcon width={20} height={20} alt="" />,
          l10n: "nav-email-dashboard",
        })}

        {renderMenuItem({
          url: "/phone",
          isVisible: isLoggedIn && isPhonesAvailable,
          icon: <PhoneIcon width={20} height={20} alt="" />,
          l10n: "nav-phone-dashboard",
        })}

        {/* omitting condition as this should always be visible */}
        {renderMenuItem({
          url: "/faq",
          icon: <FaqIcon width={20} height={20} alt="" />,
          l10n: "nav-faq",
        })}

        {!isLoggedIn && (
          <li
            className={`${styles["menu-item"]} ${styles["sign-up-menu-item"]}`}
          >
            <SignUpButton className={`${styles["sign-up-button"]}`} />
          </li>
        )}

        {renderMenuItem({
          url: "/accounts/settings",
          isVisible: isLoggedIn,
          icon: <Cogwheel width={20} height={20} alt="" />,
          l10n: "nav-settings",
        })}

        {renderMenuItem({
          url: `${runtimeData?.data?.FXA_ORIGIN}/support/?utm_source=${
            getRuntimeConfig().frontendOrigin
          }`,
          isVisible: isLoggedIn && hasPremium,
          icon: <ContactIcon width={20} height={20} alt="" />,
          l10n: "nav-contact",
        })}

        {renderMenuItem({
          url: `${supportUrl}?utm_source=${getRuntimeConfig().frontendOrigin}`,
          isVisible: isLoggedIn,
          icon: <SupportIcon width={20} height={20} alt="" />,
          l10n: "nav-support",
        })}

        {isLoggedIn && (
          <li className={`${styles["menu-item"]}`}>
            <form method="POST" action={getRuntimeConfig().fxaLogoutUrl}>
              <input
                type="hidden"
                name="csrfmiddlewaretoken"
                value={getCsrfToken()}
              />
              <button className={`${styles.link}`} type="submit">
                <SignOutIcon width={20} height={20} alt="" />
                {l10n.getString("nav-sign-out")}
              </button>
            </form>
          </li>
        )}
      </ul>
    </nav>
  );
};

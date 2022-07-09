import {
  MouseEventHandler,
  ReactElement,
  ReactNode,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useLocalization } from "@fluent/react";
import { ToastContainer, toast, Slide } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "./Layout.module.scss";
import logoTypeLight from "./images/fx-private-relay-logotype-light.svg";
import logoTypeDark from "./images/fx-private-relay-logotype-dark.svg";
import logoTypePremiumLight from "./images/fx-private-relay-premium-logotype-light.svg";
import logoTypePremiumDark from "./images/fx-private-relay-premium-logotype-dark.svg";
import logo from "./images/relay-logo.svg";
import mozillaLogo from "./images/moz-logo-bw-rgb.svg";
import { useProfiles } from "../../hooks/api/profile";
import { Navigation } from "./navigation/Navigation";
import { useIsLoggedIn } from "../../hooks/session";
import { TopMessage } from "./topmessage/TopMessage";
import { makeToast } from "../../functions/makeToast";
import { useUsers } from "../../hooks/api/user";
import { MobileNavigation } from "./navigation/MobileNavigation";
import { CloseIcon } from "../Icons";
import { PageMetadata } from "./PageMetadata";
import { RuntimeData } from "../../hooks/api/runtimeData";

export type Props = {
  children: ReactNode;
  theme?: "free" | "premium";
  runtimeData?: RuntimeData;
};

/**
 * Standard page layout for Relay, wrapping its children in the relevant header and footer.
 */
export const Layout = (props: Props) => {
  const { l10n } = useLocalization();
  const profiles = useProfiles();
  const isLoggedIn = useIsLoggedIn();
  const hasPremium: boolean = profiles.data?.[0].has_premium ?? false;
  const usersData = useUsers().data?.[0];
  const [mobileMenuExpanded, setMobileMenuExpanded] = useState<boolean>();

  useEffect(() => {
    makeToast(l10n, usersData);
  }, [l10n, usersData]);

  const isDark =
    typeof props.theme !== "undefined"
      ? props.theme === "free"
      : !profiles.data?.[0].has_premium;
  const darkClass = isDark ? styles["is-dark"] : styles["is-light"];
  const premiumLogo = isDark ? logoTypePremiumLight : logoTypePremiumDark;
  const regularLogo = isDark ? logoTypeLight : logoTypeDark;
  // The Premium logo is always shown if the user has Premium
  // (even on a page accessible to regular users with the theme
  // set to "free", like the FAQ), and if the theme is explicitly
  // set to Premium (i.e. on the `/premium` promo page).
  const logoType =
    props.theme === "premium" || hasPremium ? premiumLogo : regularLogo;
  const logoAlt =
    props.theme === "premium" || hasPremium
      ? l10n.getString("logo-alt")
      : l10n.getString("logo-premium-alt");

  const homePath = isLoggedIn ? "/accounts/profile" : "/";

  const handleToggle = () => {
    setMobileMenuExpanded(!mobileMenuExpanded);
  };

  const apiMockWarning =
    process.env.NEXT_PUBLIC_MOCK_API === "true" ? (
      <div className={styles["api-mock-warning"]}>
        This is a site to demo the Relay UI; data is fake, and changes will be
        lost after a page refresh.
      </div>
    ) : null;

  const CloseToastButton = (props: {
    closeToast: MouseEventHandler<HTMLButtonElement>;
  }): ReactElement => {
    return (
      <div className={styles["close-toast-button-container"]}>
        <button
          onClick={props.closeToast}
          className="Toastify__close-button Toastify__close-button--colored"
        >
          <CloseIcon
            alt={l10n.getString("toast-button-close-label")}
            id={styles["close-toast-button-icon"]}
          />
        </button>
      </div>
    );
  };

  return (
    <>
      <PageMetadata />
      <div className={styles.wrapper}>
        {apiMockWarning}
        <TopMessage
          profile={profiles.data?.[0]}
          runtimeData={props.runtimeData}
        />
        <header className={`${styles.header} ${darkClass}`}>
          <div className={styles["logo-wrapper"]}>
            <Link href={homePath}>
              <a className={styles.logo}>
                <img
                  src={logo.src}
                  alt=""
                  className={styles.logomark}
                  width={42}
                />
                <img
                  src={logoType.src}
                  alt={logoAlt}
                  className={styles.logotype}
                  height={20}
                />
              </a>
            </Link>
          </div>
          <div className={styles["nav-wrapper"]}>
            <Navigation
              mobileMenuExpanded={mobileMenuExpanded}
              theme={isDark ? "free" : "premium"}
              handleToggle={handleToggle}
              hasPremium={hasPremium}
              isLoggedIn={isLoggedIn}
              profile={profiles.data?.[0]}
            />
          </div>
        </header>

        <ToastContainer
          icon={false}
          position={toast.POSITION.TOP_CENTER}
          theme="colored"
          transition={Slide}
          hideProgressBar={true}
          autoClose={5000}
          className={styles["toast-container"]}
          toastClassName={`Toastify__toast ${styles.toast}`}
          closeButton={CloseToastButton}
        />

        <div className={styles["non-header-wrapper"]}>
          <MobileNavigation
            mobileMenuExpanded={mobileMenuExpanded}
            hasPremium={hasPremium}
            isLoggedIn={isLoggedIn}
            userEmail={usersData?.email}
            userAvatar={profiles.data?.[0].avatar}
          />
          <div className={styles.content}>{props.children}</div>
          <footer className={styles.footer}>
            <a
              href="https://www.mozilla.org"
              className={styles["mozilla-logo"]}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={mozillaLogo.src}
                alt={l10n.getString("logo-mozilla-alt")}
                width={120}
              />
            </a>
            <ul className={styles.meta}>
              <li>
                <a
                  href="https://www.mozilla.org/privacy/firefox-relay/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l10n.getString("nav-footer-privacy")}
                </a>
              </li>
              <li>
                <a
                  href="https://www.mozilla.org/about/legal/terms/firefox-relay/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l10n.getString("nav-footer-relay-terms")}
                </a>
              </li>
              <li>
                <a
                  href="https://www.mozilla.org/about/legal/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l10n.getString("nav-footer-legal")}
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/mozilla/fx-private-relay"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </footer>
        </div>
      </div>
    </>
  );
};

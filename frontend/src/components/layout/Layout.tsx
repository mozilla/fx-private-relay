import { ReactElement, ReactNode, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useLocalization } from "@fluent/react";
import { ToastContainer, toast, Slide } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "./Layout.module.scss";
import logoTypeLight from "../../../../static/images/fx-private-relay-logotype-light.svg";
import logoTypeDark from "../../../../static/images/fx-private-relay-logotype-dark.svg";
import logoTypePremiumLight from "../../../../static/images/fx-private-relay-premium-logotype-light.svg";
import logoTypePremiumDark from "../../../../static/images/fx-private-relay-premium-logotype-dark.svg";
import logo from "../../../../static/images/placeholder-logo.svg";
import mozillaLogo from "../../../../static/images/logos/moz-logo-bw-rgb.svg";
import favicon from "../../../public/favicon.svg";
import socialMediaImage from "../../../../static/images/share-relay.jpg";
import { useProfiles } from "../../hooks/api/profile";
import { Navigation } from "./navigation/Navigation";
import { useIsLoggedIn } from "../../hooks/session";
import { NpsSurvey } from "./NpsSurvey";
import { getRuntimeConfig } from "../../config";
import { CsatSurvey } from "./CsatSurvey";
import { InterviewRecruitment } from "./InterviewRecruitment";
import { makeToast } from "../../functions/makeToast";
import { useUsers } from "../../hooks/api/user";
import { MobileNavigation } from "./navigation/MobileNavigation";
import { CloseIcon } from "../Icons";

export type Props = {
  children: ReactNode;
  theme?: "free" | "premium";
};

/**
 * Standard page layout for Relay, wrapping its children in the relevant header and footer.
 */
export const Layout = (props: Props) => {
  const { l10n } = useLocalization();
  const profiles = useProfiles();
  const isLoggedIn = useIsLoggedIn();
  const router = useRouter();
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

  const csatSurvey =
    getRuntimeConfig().featureFlags.csatSurvey &&
    !getRuntimeConfig().featureFlags.interviewRecruitment &&
    profiles.data?.[0] ? (
      <CsatSurvey profile={profiles.data[0]} />
    ) : null;
  const npsSurvey =
    !getRuntimeConfig().featureFlags.csatSurvey &&
    !getRuntimeConfig().featureFlags.interviewRecruitment ? (
      <NpsSurvey />
    ) : null;

  const apiMockWarning =
    process.env.NEXT_PUBLIC_MOCK_API === "true" ? (
      <div className={styles["api-mock-warning"]}>
        This is a site to demo the Relay UI; data is fake, and changes will be
        lost after a page refresh.
      </div>
    ) : null;

  const closeToastButton = (closeToast: () => void): ReactElement => {
    return (
      <div className={styles["close-toast-button-container"]}>
        <button className="Toastify__close-button Toastify__close-button--colored">
          {CloseIcon({
            alt: l10n.getString("toast-button-close-label"),
            onClick: closeToast,
            id: styles["close-toast-button-icon"],
          })}
        </button>
      </div>
    );
  };

  return (
    <>
      <Head>
        <link rel="icon" type="image/svg+xml" href={favicon.src}></link>
        <title>{l10n.getString("meta-title")}</title>
        <meta
          name="description"
          content={l10n.getString("meta-description-2")}
        />
        <meta
          property="og:url"
          content={getRuntimeConfig().frontendOrigin + router.asPath}
        />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={l10n.getString("meta-title")} />
        <meta
          property="og:description"
          content={l10n.getString("meta-description-2")}
        />
        <meta property="og:image" content={socialMediaImage.src} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@firefox" />
        <meta name="twitter:title" content={l10n.getString("meta-title")} />
        <meta
          name="twitter:description"
          content={l10n.getString("meta-description-2")}
        />
        <meta name="twitter:image" content={socialMediaImage.src} />
      </Head>
      <div className={styles.wrapper}>
        {apiMockWarning}
        <InterviewRecruitment profile={profiles.data?.[0]} />
        {csatSurvey}
        {npsSurvey}
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

        <MobileNavigation
          mobileMenuExpanded={mobileMenuExpanded}
          hasPremium={hasPremium}
          isLoggedIn={isLoggedIn}
          userEmail={usersData?.email}
          userAvatar={profiles.data?.[0].avatar}
        />

        <ToastContainer
          icon={false}
          position={toast.POSITION.TOP_CENTER}
          theme="colored"
          transition={Slide}
          hideProgressBar={true}
          autoClose={5000}
          className={styles["toast-container"]}
          toastClassName={`Toastify__toast ${styles.toast}`}
          closeButton={(closeToastObject) =>
            closeToastButton(closeToastObject.closeToast)
          }
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
    </>
  );
};

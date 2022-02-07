import Link from "next/link";
import { useRouter } from "next/router";
import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./Navigation.module.scss";
import { useIsLoggedIn } from "../../hooks/session";
import { getRuntimeConfig } from "../../config";
import { useGaViewPing } from "../../hooks/gaViewPing";

/** Switch between the different pages of the Relay website. */
export const Navigation = () => {
  const { l10n } = useLocalization();
  const router = useRouter();

  const isLoggedIn = useIsLoggedIn();
  const homePath = isLoggedIn ? "/accounts/profile" : "/";

  const signUpButtonRef = useGaViewPing({
    category: "Sign In",
    label: "nav-profile-sign-up",
  });
  const signUpButton = isLoggedIn ? null : (
    <a
      href={getRuntimeConfig().fxaLoginUrl}
      ref={signUpButtonRef}
      onClick={() =>
        gaEvent({
          category: "Sign In",
          action: "Engage",
          label: "nav-profile-sign-up",
        })
      }
      className={styles.link}
    >
      {l10n.getString("nav-profile-sign-up")}
    </a>
  );

  const signInButtonRef = useGaViewPing({
    category: "Sign In",
    label: "nav-profile-sign-in",
  });
  const signInButton = isLoggedIn ? null : (
    <a
      href={getRuntimeConfig().fxaLoginUrl}
      ref={signInButtonRef}
      onClick={() =>
        gaEvent({
          category: "Sign In",
          action: "Engage",
          label: "nav-profile-sign-in",
        })
      }
      className={`${styles.link} ${styles.signInButton}`}
    >
      {l10n.getString("nav-profile-sign-in")}
    </a>
  );

  return (
    <nav aria-label={l10n.getString("nav-menu")} className={styles.siteNav}>
      <Link href={homePath}>
        <a
          className={`${styles.link} ${styles.homeLink} ${
            router.pathname === homePath ? styles.isActive : null
          }`}
        >
          {l10n.getString("nav-home")}
        </a>
      </Link>
      <Link href="/faq">
        <a
          className={`${styles.link} ${
            router.pathname === "/faq" ? styles.isActive : null
          }`}
        >
          {l10n.getString("nav-faq")}
        </a>
      </Link>
      {signUpButton}
      {signInButton}
    </nav>
  );
};

import Link from "next/link";
import { useRouter } from "next/router";
import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./Navigation.module.scss";
import { useIsLoggedIn } from "../../hooks/session";
import { setCookie } from "../../functions/cookies";
import { getLoginUrl, useFxaFlowTracker } from "../../hooks/fxaFlowTracker";

/** Switch between the different pages of the Relay website. */
export const Navigation = () => {
  const { l10n } = useLocalization();
  const router = useRouter();

  const isLoggedIn = useIsLoggedIn();
  const homePath = isLoggedIn ? "/accounts/profile" : "/";

  const signUpFxaFlowTracker = useFxaFlowTracker({
    category: "Sign In",
    label: "nav-profile-sign-up",
    entrypoint: "relay-sign-up-header",
  });
  const signUpUrl = getLoginUrl(
    "relay-sign-up-header",
    signUpFxaFlowTracker.flowData
  );
  const signUpButton = isLoggedIn ? null : (
    <a
      href={signUpUrl}
      ref={signUpFxaFlowTracker.ref}
      onClick={() => {
        gaEvent({
          category: "Sign In",
          action: "Engage",
          label: "nav-profile-sign-up",
        });
        setCookie("user-sign-in", "true", { maxAgeInSeconds: 60 * 60 });
      }}
      className={styles.link}
    >
      {l10n.getString("nav-profile-sign-up")}
    </a>
  );

  const signInFxaFlowTracker = useFxaFlowTracker({
    category: "Sign In",
    label: "nav-profile-sign-in",
    entrypoint: "relay-sign-in-header",
  });
  const signInUrl = getLoginUrl(
    "relay-sign-in-header",
    signInFxaFlowTracker.flowData
  );
  const signInButton = isLoggedIn ? null : (
    <a
      href={signInUrl}
      ref={signInFxaFlowTracker.ref}
      onClick={() => {
        gaEvent({
          category: "Sign In",
          action: "Engage",
          label: "nav-profile-sign-in",
        });
        setCookie("user-sign-in", "true", { maxAgeInSeconds: 60 * 60 });
      }}
      className={`${styles.link} ${styles["sign-in-button"]}`}
    >
      {l10n.getString("nav-profile-sign-in")}
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
          className={`${styles.link} ${
            router.pathname === "/faq" ? styles["is-active"] : null
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

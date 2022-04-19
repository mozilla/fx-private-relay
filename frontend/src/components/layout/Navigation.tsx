import Link from "next/link";
import { useRouter } from "next/router";
import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import styles from "./Navigation.module.scss";
import { useIsLoggedIn } from "../../hooks/session";
import { getRuntimeConfig } from "../../config";
import { useFxaFlowTracker } from "../../hooks/fxaFlowTracker";

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
  // document is undefined when prerendering the website,
  // so just use the production URL there:
  const signUpUrl = new URL(
    getRuntimeConfig().fxaLoginUrl,
    typeof document !== "undefined"
      ? document.location.origin
      : "https://relay.firefox.com"
  );
  signUpUrl.searchParams.append("form_type", "button");
  signUpUrl.searchParams.append("entrypoint", "relay-sign-up-header");
  if (signUpFxaFlowTracker.flowData) {
    signUpUrl.searchParams.append(
      "flowId",
      signUpFxaFlowTracker.flowData.flowId
    );
    signUpUrl.searchParams.append(
      "flowBeginTime",
      signUpFxaFlowTracker.flowData.flowBeginTime
    );
  }
  const signUpButton = isLoggedIn ? null : (
    <a
      href={signUpUrl.href}
      ref={signUpFxaFlowTracker.ref}
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

  const signInFxaFlowTracker = useFxaFlowTracker({
    category: "Sign In",
    label: "nav-profile-sign-in",
    entrypoint: "relay-sign-in-header",
  });
  // document is undefined when prerendering the website,
  // so just use the production URL there:
  const signInUrl = new URL(
    getRuntimeConfig().fxaLoginUrl,
    typeof document !== "undefined"
      ? document.location.origin
      : "https://relay.firefox.com"
  );
  signInUrl.searchParams.append("form_type", "button");
  signInUrl.searchParams.append("entrypoint", "relay-sign-in-header");
  if (signInFxaFlowTracker.flowData) {
    signInUrl.searchParams.append(
      "flowId",
      signInFxaFlowTracker.flowData.flowId
    );
    signInUrl.searchParams.append(
      "flowBeginTime",
      signInFxaFlowTracker.flowData.flowBeginTime
    );
  }
  const signInButton = isLoggedIn ? null : (
    <a
      href={signInUrl.href}
      ref={signInFxaFlowTracker.ref}
      onClick={() =>
        gaEvent({
          category: "Sign In",
          action: "Engage",
          label: "nav-profile-sign-in",
        })
      }
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

import { useLocalization } from "@fluent/react";
import { getRuntimeConfig } from "../../config";
import { event as gaEvent } from "react-ga";
import styles from "./SignInButton.module.scss";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { setCookie } from "../../functions/cookies";

export const SignInButton = ({ ...props }): JSX.Element => {
  const { l10n } = useLocalization();
  const signInButtonRef = useGaViewPing({
    category: "Sign In",
    label: "nav-profile-sign-in",
  });

  return (
    <a
      href={getRuntimeConfig().fxaLoginUrl}
      ref={signInButtonRef}
      onClick={() => {
        gaEvent({
          category: "Sign In",
          action: "Engage",
          label: "nav-profile-sign-in",
        });
        setCookie("user-sign-in", "true", { maxAgeInSeconds: 60 * 60 });
      }}
      className={`${styles["sign-in-button"]} ${props.className}`}
    >
      {l10n.getString("nav-profile-sign-in")}
    </a>
  );
};

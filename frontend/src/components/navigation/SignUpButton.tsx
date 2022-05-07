import { useLocalization } from "@fluent/react";
import { getRuntimeConfig } from "../../config";
import { event as gaEvent } from "react-ga";
import styles from "./SignUpButton.module.scss";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { setCookie } from "../../functions/cookies";

export const SignUpButton = ({ ...props }): JSX.Element => {
  const { l10n } = useLocalization();
  const signUpButtonRef = useGaViewPing({
    category: "Sign In",
    label: "nav-profile-sign-up",
  });

  return (
    <a
      href={getRuntimeConfig().fxaLoginUrl}
      ref={signUpButtonRef}
      onClick={() => {
        gaEvent({
          category: "Sign In",
          action: "Engage",
          label: "nav-profile-sign-up",
        });
        setCookie("user-sign-in", "true", { maxAgeInSeconds: 60 * 60 });
      }}
      className={`${styles["sign-up-button"]} ${props.className ?? ""}`}
    >
      {l10n.getString("nav-profile-sign-up")}
    </a>
  );
};

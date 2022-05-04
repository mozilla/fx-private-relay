import { useLocalization } from "@fluent/react";
import { getRuntimeConfig } from "../../config";
import { event as gaEvent } from "react-ga";
import styles from "./SignUpButton.module.scss";
import { useGaViewPing } from "../../hooks/gaViewPing";

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
      onClick={() =>
        gaEvent({
          category: "Sign In",
          action: "Engage",
          label: "nav-profile-sign-up",
        })
      }
      className={`${styles.link} ${props.className} ${styles["sign-up-button"]}`}
    >
      {l10n.getString("nav-profile-sign-up")}
    </a>
  );
};

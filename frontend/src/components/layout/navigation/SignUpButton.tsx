import React from "react";
import styles from "./SignUpButton.module.scss";
import { setCookie } from "../../../functions/cookies";
import { useGaEvent } from "../../../hooks/gaEvent";
import { getLoginUrl, useFxaFlowTracker } from "../../../hooks/fxaFlowTracker";
import { useL10n } from "../../../hooks/l10n";

export type Props = {
  className: string;
};
export const SignUpButton = (props: Props): React.JSX.Element => {
  const l10n = useL10n();
  const signUpFxaFlowTracker = useFxaFlowTracker({
    category: "Sign In",
    label: "nav-profile-sign-up",
    entrypoint: "relay-sign-up-header",
  });
  const signUpUrl = getLoginUrl(
    "relay-sign-up-header",
    signUpFxaFlowTracker.flowData,
  );
  const gaEvent = useGaEvent();

  return (
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
      className={`${styles["sign-up-button"]} ${props.className ?? ""}`}
    >
      {l10n.getString("nav-profile-sign-up")}
    </a>
  );
};

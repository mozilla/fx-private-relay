import React from "react";
import styles from "./SignUpButton.module.scss";
import { setCookie } from "../../../functions/cookies";
import { useGaEvent } from "../../../hooks/gaEvent";
import { getLoginUrl, useFxaFlowTracker } from "../../../hooks/fxaFlowTracker";
import { useL10n } from "../../../hooks/l10n";
import { useUtmApplier } from "../../../hooks/utmApplier";

export type Props = {
  className: string;
};
export const SignUpButton = (props: Props): React.JSX.Element => {
  const l10n = useL10n();
  const { flowData: signUpFlowData, ref: signUpRef } = useFxaFlowTracker({
    category: "Sign In",
    label: "nav-profile-sign-up",
    entrypoint: "relay-sign-up-header",
  });
  const applyUtmParams = useUtmApplier();
  const signUpUrl = applyUtmParams(
    getLoginUrl("relay-sign-up-header", signUpFlowData),
  );
  const gaEvent = useGaEvent();

  return (
    <a
      href={signUpUrl}
      ref={signUpRef}
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

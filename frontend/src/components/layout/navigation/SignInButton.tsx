import { event as gaEvent } from "react-ga";
import styles from "./SignInButton.module.scss";
import { setCookie } from "../../../functions/cookies";
import { getLoginUrl, useFxaFlowTracker } from "../../../hooks/fxaFlowTracker";
import { useL10n } from "../../../hooks/l10n";

export type Props = {
  className?: string;
};

export const SignInButton = (props: Props): JSX.Element => {
  const l10n = useL10n();
  const signInFxaFlowTracker = useFxaFlowTracker({
    category: "Sign In",
    label: "nav-profile-sign-in",
    entrypoint: "relay-sign-in-header",
  });
  const signInUrl = getLoginUrl(
    "relay-sign-in-header",
    signInFxaFlowTracker.flowData,
  );

  return (
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
      className={`${styles["sign-in-button"]} ${props.className ?? ""}`}
    >
      {l10n.getString("nav-profile-sign-in")}
    </a>
  );
};

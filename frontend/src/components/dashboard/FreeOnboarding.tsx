import styles from "./FreeOnboarding.module.scss";
import { ProfileData } from "../../hooks/api/profile";
import { VisuallyHidden } from "../VisuallyHidden";
import { getRuntimeConfig } from "../../config";
import { useL10n } from "../../hooks/l10n";
import { useMinViewportWidth } from "../../hooks/mediaQuery";
import WomanEmail from "./images/woman-email.svg";
import CheckMark from "./images/welcome-to-relay-check.svg";
import Plus from "./images/welcome-to-relay-plus.svg";
import Image from "next/image";
import { Button } from "../Button";
import { event as gaEvent } from "react-ga";
import { useGaViewPing } from "../../hooks/gaViewPing";

export type Props = {
  profile: ProfileData;
  onNextStep: (step: number) => void;
  onPickSubdomain: (subdomain: string) => void;
  generateNewMask: () => void;
  hasReachedFreeMaskLimit: boolean;
};

/**
 * Shows the user how to take advantage of Premium features when they've just upgraded.
 */
export const FreeOnboarding = (props: Props) => {
  const l10n = useL10n();
  const isLargeScreen = useMinViewportWidth("md");

  let step = null;
  let button = null;
  let skipButton = null;

  const skipMasskButtonRef = useGaViewPing({
    category: "Free Onboarding",
    label: "free-onboarding-step-1-skip",
    value: 1,
  });

  if (props.profile) {
    console.log(props.profile);
  }

  if (props.profile.onboarding_state === 0) {
    const skipMaskCreation = () => {
      props.onNextStep(1);
      gaEvent({
        category: "Premium Onboarding",
        action: "Engage",
        label: "onboarding-step-1-continue",
        value: 1,
      });
    };

    step = <StepOne />;

    skipButton = (
      <button
        ref={skipMasskButtonRef}
        className={styles["skip-link"]}
        onClick={skipMaskCreation}
      >
        {l10n.getString("profile-free-onboarding--skip-step-one")}
      </button>
    );

    button = (
      <Button className={styles["generate-new-mask"]}>
        {l10n.getString("profile-free-onboarding--welcome-generate-new-mask")}{" "}
        <Image src={Plus} alt="" />
      </Button>
    );
  }

  return (
    <>
      <section className={styles.onboarding}>
        {step}
        <div className={styles.controls}>
          {button}
          <VisuallyHidden>
            <progress
              max={getRuntimeConfig().maxOnboardingAvailable}
              value={props.profile.onboarding_state + 1}
            >
              {l10n.getString("multi-part-onboarding-step-counter", {
                step: props.profile.onboarding_state,
                max: getRuntimeConfig().maxOnboardingAvailable,
              })}
            </progress>
          </VisuallyHidden>
          <ol className={styles["styled-progress-bar"]} aria-hidden={true}>
            <li
              className={
                props.profile.onboarding_state >= 0
                  ? styles["is-completed"]
                  : undefined
              }
            >
              <span></span>1
            </li>
            <li
              className={
                props.profile.onboarding_state >= 1
                  ? styles["is-completed"]
                  : undefined
              }
            >
              <span></span>2
            </li>
            <li
              className={
                props.profile.onboarding_state >= 2
                  ? styles["is-completed"]
                  : undefined
              }
            >
              <span></span>3
            </li>
          </ol>

          {skipButton}
        </div>
      </section>
    </>
  );
};

const StepOne = () => {
  const l10n = useL10n();

  return (
    <div className={`${styles.step} ${styles["step-welcome"]}`}>
      <div className={styles["welcome-header"]}>
        <h1>{l10n.getString("profile-free-onboarding--welcome-headline")}</h1>
        <p>{l10n.getString("profile-free-onboarding--welcome-description")}</p>
      </div>
      <div className={styles["content-wrapper"]}>
        <Image src={WomanEmail} alt="" width={475} />
        <div className={styles["content-text"]}>
          <div>
            <Image src={CheckMark} alt="" />
            <p className={styles["headline"]}>
              {l10n.getString(
                "profile-free-onboarding--welcome-item-headline-1",
              )}
            </p>
            <p className={styles["description"]}>
              {l10n.getString(
                "profile-free-onboarding--welcome-item-description-1",
              )}
            </p>
          </div>
          <div>
            <p className={styles["headline"]}>
              {l10n.getString(
                "profile-free-onboarding--welcome-item-headline-2",
              )}
            </p>
            <p className={styles["description"]}>
              {l10n.getString(
                "profile-free-onboarding--welcome-item-description-2",
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

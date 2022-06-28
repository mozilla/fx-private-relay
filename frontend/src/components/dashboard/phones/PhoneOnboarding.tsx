import { ProfileData } from "../../../hooks/api/profile";
import { getRuntimeConfig } from "../../../config";
import { event as gaEvent } from "react-ga";
import styles from "./PhoneOnboarding.module.scss";
import { useLocalization } from "@fluent/react";
import WomanPhone from "./images/woman-phone.svg";
import PhoneVerify from "./images/phone-verify.svg";
import { VisuallyHidden } from "react-aria";
import { Button, LinkButton } from "../../Button";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import { getPhoneSubscribeLink } from "../../../functions/getPlan";
import { RuntimeData, useRuntimeData } from "../../../hooks/api/runtimeData";

export type Props = {
  profile: ProfileData;
  onNextStep: (step: number) => void;
  // onPickSubdomain: (subdomain: string) => void;
};

export const PhoneOnboarding = (props: Props) => {
  const { l10n } = useLocalization();

  const upgradeToPhoneMasking = useGaViewPing({
    category: "Phone Onboarding",
    label: "onboarding-step-1-continue",
    value: 1,
  });

  const quit = () => {
    // props.onNextStep(getRuntimeConfig().maxPhoneOnboardingAvailable);
    gaEvent({
      category: "Phone Onboarding",
      action: "Engage",
      label: "onboarding-skip",
      value: props.profile.onboarding_state + 1,
    });
  };

  let step = null;
  //   let button = null;

  //   if (props.profile.onboarding_state === 0) {
  step = <StepTwo />;
  // button = (
  //     // <Button ref={getStartedButtonRef} onClick={getStarted}>

  //   );

  return (
    <>
      <section className={styles.onboarding}>
        {step}
        <div className={styles.controls}>
          {/* {button} */}
          {/*
            Unfortunately <progress> is hard to style like we want, even though it expresses what we want.
            Thus, we render a <progress> for machines, and hide the styled elements for them.
            // TODO: Use react-aria's useProgressBar()?
          */}
          {/* <VisuallyHidden>
            <progress
              max={getRuntimeConfig().maxOnboardingAvailable}
              value={props.profile.onboarding_state + 1}
            >
              {l10n.getString("multi-part-onboarding-step-counter", {
                step: props.profile.onboarding_state,
                max: getRuntimeConfig().maxOnboardingAvailable,
              })}
            </progress>
          </VisuallyHidden> */}
          {/* <ol className={styles["styled-progress-bar"]} aria-hidden={true}>
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
          </ol> */}
          {/* <button className={styles["skip-link"]} onClick={() => quit()}>
            {l10n.getString("profile-label-skip")}
          </button> */}
        </div>
      </section>
    </>
  );
};

const StepOne = () => {
  const { l10n } = useLocalization();
  const runtimeData = useRuntimeData();

  const purchase = () => {
    gaEvent({
      category: "Purchase Button",
      action: "Engage",
      label: "phone-cta",
    });
  };

  return (
    <div className={`${styles.step} ${styles["step-welcome"]}`}>
      <div className={styles.lead}>
        <img src={WomanPhone.src} alt="" width={400} />
        <h2>{l10n.getString("phone-onboarding-step1-headline")}</h2>
        <p>{l10n.getString("phone-onboarding-step1-body")}</p>
      </div>
      <div className={styles.description}>
        <ul>
          <li>{l10n.getString("phone-onboarding-step1-list-item-1")}</li>
          <li>{l10n.getString("phone-onboarding-step1-list-item-2")}</li>
          <li>{l10n.getString("phone-onboarding-step1-list-item-3")}</li>
        </ul>
        <div className={styles.action}>
          <h3>
            {l10n.getString("phone-onboarding-step1-button-label")}
            <span>{l10n.getString("phone-onboarding-step1-button-price")}</span>
          </h3>
          <LinkButton
            ref={useGaViewPing({
              category: "Purchase Button",
              label: "premium-promo-cta",
            })}
            href={getPhoneSubscribeLink(runtimeData.data)}
            onClick={() => purchase()}
          >
            {l10n.getString("premium-promo-hero-cta")}
          </LinkButton>
        </div>
      </div>
    </div>
  );
};

const StepTwo = () => {
  const { l10n } = useLocalization();

  return (
    <div className={`${styles.step}`}>
      <div className={styles.lead}>
        <img src={PhoneVerify.src} alt="" width={400} />
        <h2>{l10n.getString("phone-onboarding-step2-headline")}</h2>
        <p>{l10n.getString("phone-onboarding-step2-body")}</p>
      </div>
      <form className={styles.form}>
        <input
          className={`${styles["c-verify-phone-input"]}`}
          placeholder={l10n.getString(
            "phone-onboarding-step2-input-placeholder"
          )}
          type="tel"
          required={true}
        />
        <Button className={styles.button} type="submit">
          {l10n.getString("phone-onboarding-step2-button-cta")}
        </Button>
      </form>
    </div>
  );
};

import { useState } from "react";
import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import { useOverlayTriggerState } from "react-stately";
import styles from "./PremiumOnboarding.module.scss";
import checkIcon from "../../../../static/images/icon-check.svg";
import ManLaptopEmail from "../../../../static/images/dashboard-onboarding/man-laptop-email-alt.svg";
import WomanOnCouch from "../../../../static/images/dashboard-onboarding/woman-couch.svg";
import WomanEmail from "../../../../static/images/dashboard-onboarding/woman-email.svg";
import { Button, LinkButton } from "../Button";
import { useGaPing } from "../../hooks/gaPing";
import { ProfileData } from "../../hooks/api/profile";
import { SubdomainSearchForm } from "./subdomain/SearchForm";
import { SubdomainConfirmationModal } from "./subdomain/ConfirmationModal";
import { VisuallyHidden } from "react-aria";
import { getRuntimeConfig } from "../../config";
import { useMinViewportWidth } from "../../hooks/mediaQuery";

export type Props = {
  profile: ProfileData;
  onNextStep: (step: number) => void;
  onPickSubdomain: (subdomain: string) => void;
};

export const PremiumOnboarding = (props: Props) => {
  const { l10n } = useLocalization();
  const getStartedButtonRef = useGaPing({
    category: "Premium Onboarding",
    label: "onboarding-step-1-continue",
    value: 1,
  });
  const skipDomainButtonRef = useGaPing({
    category: "Premium Onboarding",
    label: "onboarding-step-2-skip",
    value: 2,
  });
  const continueWithDomainButtonRef = useGaPing({
    category: "Premium Onboarding",
    label: "onboarding-step-2-continue",
    value: 2,
  });
  const skipAddonButtonRef = useGaPing({
    category: "Premium Onboarding",
    label: "onboarding-step-3-skip",
    value: 3,
  });
  const continueWithAddonButtonRef = useGaPing({
    category: "Premium Onboarding",
    label: "onboarding-step-3-continue",
    value: 3,
  });

  const quit = () => {
    props.onNextStep(getRuntimeConfig().maxOnboardingAvailable);
    gaEvent({
      category: "Premium Onboarding",
      action: "Engage",
      label: "onboarding-skip",
      value: props.profile.onboarding_state + 1,
    });
  };

  let step = null;
  let button = null;
  if (props.profile.onboarding_state === 0) {
    step = <StepOne />;

    const getStarted = () => {
      props.onNextStep(1);
      gaEvent({
        category: "Premium Onboarding",
        action: "Engage",
        label: "onboarding-step-1-continue",
        value: 1,
      });
    };

    button = (
      <Button ref={getStartedButtonRef} onClick={getStarted}>
        {l10n.getString("multi-part-onboarding-premium-welcome-button-start")}
      </Button>
    );
  }

  if (props.profile.onboarding_state === 1) {
    step = (
      <StepTwo
        profile={props.profile}
        onPickSubdomain={props.onPickSubdomain}
      />
    );

    if (typeof props.profile.subdomain !== "string") {
      const skipDomain = () => {
        props.onNextStep(2);
        gaEvent({
          category: "Premium Onboarding",
          action: "Engage",
          label: "onboarding-step-2-skip",
          value: 2,
        });
      };

      button = (
        <button
          ref={skipDomainButtonRef}
          onClick={skipDomain}
          className={styles.skipLink}
        >
          {l10n.getString("multi-part-onboarding-premium-domain-button-skip")}
        </button>
      );
    } else {
      const getAddon = () => {
        props.onNextStep(2);
        gaEvent({
          category: "Premium Onboarding",
          action: "Engage",
          label: "onboarding-step-2-continue",
          value: 2,
        });
      };
      button = (
        <Button ref={continueWithDomainButtonRef} onClick={getAddon}>
          {l10n.getString("profile-label-continue")}
        </Button>
      );
    }
  }

  if (props.profile.onboarding_state === 2) {
    step = <StepThree />;

    const skipAddon = () => {
      props.onNextStep(3);
      gaEvent({
        category: "Premium Onboarding",
        action: "Engage",
        label: "onboarding-step-3-skip",
        value: 3,
      });
    };
    const goToDashboard = () => {
      props.onNextStep(3);
      gaEvent({
        category: "Premium Onboarding",
        action: "Engage",
        label: "onboarding-step-3-continue",
        value: 3,
      });
    };

    button = (
      <>
        <Button
          ref={continueWithAddonButtonRef}
          onClick={goToDashboard}
          className={`is-visible-with-addon ${styles.goToDashboardButton}`}
        >
          {l10n.getString(
            "multi-part-onboarding-premium-extension-button-dashboard"
          )}
        </Button>
        <button
          ref={skipAddonButtonRef}
          onClick={skipAddon}
          className={`is-hidden-with-addon ${styles.getAddonButton} ${styles.skipLink}`}
        >
          {l10n.getString(
            "multi-part-onboarding-premium-extension-button-skip"
          )}
        </button>
      </>
    );
  }

  return (
    <>
      <section className={styles.onboarding}>
        {step}
        <div className={styles.controls}>
          {button}
          {/*
            Unfortunately <progress> is hard to style like we want, even though it expresses what we want.
            Thus, we render a <progress> for machines, and hide the styled elements for them.
            // TODO: Use react-aria's useProgressBar()?
          */}
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
          <ol className={styles.styledProgressBar} aria-hidden={true}>
            <li
              className={
                props.profile.onboarding_state >= 0
                  ? styles.isCompleted
                  : undefined
              }
            >
              <span></span>1
            </li>
            <li
              className={
                props.profile.onboarding_state >= 1
                  ? styles.isCompleted
                  : undefined
              }
            >
              <span></span>2
            </li>
            <li
              className={
                props.profile.onboarding_state >= 2
                  ? styles.isCompleted
                  : undefined
              }
            >
              <span></span>3
            </li>
          </ol>
          <button className={styles.skipLink} onClick={() => quit()}>
            {l10n.getString("profile-label-skip")}
          </button>
        </div>
      </section>
    </>
  );
};

const StepOne = () => {
  const { l10n } = useLocalization();
  const isLargeScreen = useMinViewportWidth("md");

  return (
    <div className={`${styles.step} ${styles.stepWelcome}`}>
      <div>
        <h2>
          {l10n.getString("multi-part-onboarding-premium-welcome-headline")}
        </h2>
        <p className={styles.lead}>
          {l10n.getString("multi-part-onboarding-premium-welcome-subheadline")}
        </p>
      </div>
      <div className={styles.description}>
        <img src={WomanOnCouch.src} alt="" width={350} />
        <p>
          <span className={styles.descriptionCaption}>
            {l10n.getString("onboarding-premium-title-detail")}
          </span>
          <br />
          <strong>
            {l10n.getString("multi-part-onboarding-premium-welcome-title")}
          </strong>
          <br />
          {l10n.getString(
            isLargeScreen
              ? "onboarding-premium-control-description"
              : "multi-part-onboarding-premium-welcome-description"
          )}
        </p>
      </div>
    </div>
  );
};

type Step2Props = {
  profile: ProfileData;
  onPickSubdomain: (subdomain: string) => void;
};
const StepTwo = (props: Step2Props) => {
  const { l10n } = useLocalization();

  const subdomain =
    typeof props.profile.subdomain === "string" ? (
      <div className={styles.actionComplete}>
        <img src={checkIcon.src} alt="" width={18} />
        <samp>
          @{props.profile.subdomain}.{getRuntimeConfig().mozmailDomain}
        </samp>
      </div>
    ) : (
      <Step2SubdomainPicker onPickSubdomain={props.onPickSubdomain} />
    );

  return (
    <div className={`${styles.step} ${styles.stepCustomDomain}`}>
      <div>
        <h2>{l10n.getString("multi-part-onboarding-premium-get-domain")}</h2>
      </div>
      <div className={styles.description}>
        <img src={WomanEmail.src} alt="" width={400} />
        <div>
          <p className={styles.subdomainDescription}>
            <span className={styles.descriptionCaption}>
              {l10n.getString("onboarding-premium-title-detail")}
            </span>
            <br />
            <strong>{l10n.getString("onboarding-premium-domain-title")}</strong>
            <br />
            {l10n.getString(
              "multi-part-onboarding-premium-get-domain-description-2",
              {
                mozmail: "mozmail.com",
              }
            )}
          </p>
          <div>{subdomain}</div>
        </div>
      </div>
    </div>
  );
};

type Step2SubdomainPickerProps = {
  onPickSubdomain: (subdomain: string) => void;
};
const Step2SubdomainPicker = (props: Step2SubdomainPickerProps) => {
  const { l10n } = useLocalization();
  const [chosenSubdomain, setChosenSubdomain] = useState("");

  const modalState = useOverlayTriggerState({});

  const onPick = (subdomain: string) => {
    setChosenSubdomain(subdomain);
    modalState.open();
  };

  const onConfirm = () => {
    props.onPickSubdomain(chosenSubdomain);
    modalState.close();
  };

  const dialog = modalState.isOpen ? (
    <SubdomainConfirmationModal
      subdomain={chosenSubdomain}
      isOpen={modalState.isOpen}
      onClose={() => modalState.close()}
      onConfirm={onConfirm}
    />
  ) : null;

  return (
    <>
      <p className={styles.subdomainPickerHeading}>
        {l10n.getString("multi-part-onboarding-premium-domain-cta")}
      </p>
      <samp className={styles.domainExample}>
        ***@
        <span className={styles.customizablePart}>
          {l10n.getString("banner-register-subdomain-example-address")}
        </span>
        .{getRuntimeConfig().mozmailDomain}
      </samp>
      <SubdomainSearchForm onPick={onPick} />
      {dialog}
    </>
  );
};

const StepThree = () => {
  const { l10n } = useLocalization();
  const isLargeScreen = useMinViewportWidth("md");

  return (
    <div className={`${styles.step} ${styles.stepAddon}`}>
      <div>
        <h2>
          {l10n.getString(
            isLargeScreen
              ? "multi-part-onboarding-premium-extension-get-title"
              : "multi-part-onboarding-reply-headline"
          )}
        </h2>
      </div>
      <div className={styles.description}>
        <img src={ManLaptopEmail.src} alt="" width={500} />
        <div>
          <p>
            <span className={styles.descriptionCaption}>
              {l10n.getString("onboarding-premium-title-detail")}
            </span>
            <br />
            <strong>{l10n.getString("onboarding-premium-reply-title")}</strong>
            <br />
            {l10n.getString("onboarding-premium-reply-description")}
          </p>
          <div className={`${styles.addonDescription} is-hidden-with-addon`}>
            <h3>
              {l10n.getString(
                "multi-part-onboarding-premium-extension-get-title"
              )}
            </h3>
            <p>
              {l10n.getString(
                "multi-part-onboarding-premium-extension-get-description"
              )}
            </p>
            <LinkButton
              href="https://addons.mozilla.org/firefox/addon/private-relay/?utm_source=fx-relay&utm_medium=onboarding&utm_campaign=install-addon"
              target="_blank"
              className={styles.getAddonButton}
            >
              {l10n.getString(
                "multi-part-onboarding-premium-extension-button-download"
              )}
            </LinkButton>
          </div>
          <div className={`${styles.addonDescription} is-visible-with-addon`}>
            <div className={styles.actionComplete}>
              <img src={checkIcon.src} alt="" width={18} />
              {l10n.getString("multi-part-onboarding-premium-extension-added")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

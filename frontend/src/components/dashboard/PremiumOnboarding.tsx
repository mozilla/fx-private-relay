import { useState } from "react";
import { useLocalization } from "@fluent/react";
import { event as gaEvent } from "react-ga";
import { useOverlayTriggerState } from "react-stately";
import styles from "./PremiumOnboarding.module.scss";
import ManLaptopEmail from "./images/man-laptop-email-alt.svg";
import WomanOnCouch from "./images/woman-couch.svg";
import WomanEmail from "./images/woman-email.svg";
import { Button, LinkButton } from "../Button";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { ProfileData } from "../../hooks/api/profile";
import { SubdomainSearchForm } from "./subdomain/SearchForm";
import { SubdomainConfirmationModal } from "./subdomain/ConfirmationModal";
import { VisuallyHidden } from "react-aria";
import { getRuntimeConfig } from "../../config";
import { useMinViewportWidth } from "../../hooks/mediaQuery";
import {
  supportsChromeExtension,
  supportsFirefoxExtension,
  supportsAnExtension,
} from "../../functions/userAgent";
import { CheckBadgeIcon } from "../Icons";

export type Props = {
  profile: ProfileData;
  onNextStep: (step: number) => void;
  onPickSubdomain: (subdomain: string) => void;
};

/**
 * Shows the user how to take advantage of Premium features when they've just upgraded.
 */
export const PremiumOnboarding = (props: Props) => {
  const { l10n } = useLocalization();
  const getStartedButtonRef = useGaViewPing({
    category: "Premium Onboarding",
    label: "onboarding-step-1-continue",
    value: 1,
  });
  const skipDomainButtonRef = useGaViewPing({
    category: "Premium Onboarding",
    label: "onboarding-step-2-skip",
    value: 2,
  });
  const continueWithDomainButtonRef = useGaViewPing({
    category: "Premium Onboarding",
    label: "onboarding-step-2-continue",
    value: 2,
  });
  const skipAddonButtonRef = useGaViewPing({
    category: "Premium Onboarding",
    label: "onboarding-step-3-skip",
    value: 3,
  });
  const continueWithAddonButtonRef = useGaViewPing({
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
          className={styles["skip-link"]}
        >
          {l10n.getString("multi-part-onboarding-premium-domain-button-skip-2")}
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
          className={`is-visible-with-addon ${styles["go-to-dashboard-button"]}`}
        >
          {l10n.getString(
            "multi-part-onboarding-premium-extension-button-dashboard"
          )}
        </Button>
        <button
          ref={skipAddonButtonRef}
          onClick={skipAddon}
          className={`is-hidden-with-addon ${styles["get-addon-button"]} ${styles["skip-link"]}`}
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
          <button className={styles["skip-link"]} onClick={() => quit()}>
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
    <div className={`${styles.step} ${styles["step-welcome"]}`}>
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
          <span className={styles["description-caption"]}>
            {l10n.getString("onboarding-premium-title-detail")}
          </span>
          <br />
          <strong>
            {l10n.getString(
              "multi-part-onboarding-premium-generate-unlimited-title-2"
            )}
          </strong>
          <br />
          {l10n.getString(
            isLargeScreen
              ? "onboarding-premium-control-description-2"
              : "multi-part-onboarding-premium-welcome-description-2"
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
      <p className={styles["action-complete"]}>
        <span className={styles.label}>
          <CheckBadgeIcon alt="" width={18} height={18} />
          {l10n.getString("profile-label-subdomain")}
        </span>
        <samp>@{props.profile.subdomain}</samp>
        <span className={styles.domain}>
          .{getRuntimeConfig().mozmailDomain}
        </span>
      </p>
    ) : (
      <Step2SubdomainPicker
        onPickSubdomain={props.onPickSubdomain}
        profile={props.profile}
      />
    );

  return (
    <div className={`${styles.step} ${styles["step-custom-domain"]}`}>
      <div>
        <h2>{l10n.getString("multi-part-onboarding-premium-get-subdomain")}</h2>
      </div>
      <div className={styles.description}>
        <img src={WomanEmail.src} alt="" width={400} />
        <div>
          <p className={styles["subdomain-description"]}>
            <span className={styles["description-caption"]}>
              {l10n.getString("onboarding-premium-title-detail")}
            </span>
            <br />
            <strong>
              {l10n.getString("onboarding-premium-domain-title-3")}
            </strong>
            <br />
            {l10n.getString(
              "multi-part-onboarding-premium-get-domain-description-3",
              {
                mozmail: ".mozmail.com",
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
  profile: ProfileData;
};
const Step2SubdomainPicker = (props: Step2SubdomainPickerProps) => {
  const { l10n } = useLocalization();
  const [chosenSubdomain, setChosenSubdomain] = useState("");
  const [partialSubdomain, setPartialSubdomain] = useState("");

  const modalState = useOverlayTriggerState({});

  const onPick = (subdomain: string) => {
    setChosenSubdomain(subdomain);
    modalState.open();
  };

  const onConfirm = () => {
    props.onPickSubdomain(chosenSubdomain);
    modalState.close();
  };

  const onType = (_partial: string) => {
    setPartialSubdomain(_partial);
  };

  const dialog = modalState.isOpen ? (
    <SubdomainConfirmationModal
      subdomain={chosenSubdomain}
      isOpen={modalState.isOpen}
      isSet={typeof props.profile.subdomain === "string"}
      onClose={() => modalState.close()}
      onConfirm={onConfirm}
    />
  ) : null;

  return (
    <>
      <p className={styles["subdomain-picker-heading"]}>
        {l10n.getString("multi-part-onboarding-premium-domain-cta-2")}
      </p>
      <samp className={styles["domain-example"]}>
        ***@
        <span className={styles["customizable-part"]}>
          {partialSubdomain !== ""
            ? partialSubdomain
            : l10n.getString("banner-register-subdomain-example-address")}
        </span>
        .{getRuntimeConfig().mozmailDomain}
      </samp>
      <SubdomainSearchForm onType={onType} onPick={onPick} />
      {dialog}
    </>
  );
};

const StepThree = () => {
  const { l10n } = useLocalization();

  return (
    <div className={`${styles.step} ${styles["step-addon"]}`}>
      <div>
        <StepThreeTitle />
      </div>
      <div className={styles.description}>
        <img src={ManLaptopEmail.src} alt="" width={500} />
        <div>
          <p className={styles["reply-description"]}>
            <span className={styles["description-caption"]}>
              {l10n.getString("onboarding-premium-title-detail")}
            </span>
            <br />
            <strong>
              {l10n.getString("onboarding-premium-reply-title-2")}
            </strong>
            <br />
            {l10n.getString("onboarding-premium-reply-description-2")}
          </p>
          <AddonDescription />
          <div
            className={`${styles["addon-description"]} is-visible-with-addon`}
          >
            <div className={styles["action-complete"]}>
              <CheckBadgeIcon alt="" width={18} height={18} />
              {l10n.getString("multi-part-onboarding-premium-extension-added")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StepThreeTitle = () => {
  const { l10n } = useLocalization();
  const isLargeScreen = useMinViewportWidth("md");
  if (!isLargeScreen) {
    return <h2>{l10n.getString("multi-part-onboarding-reply-headline")}</h2>;
  }
  return (
    <h2>
      {l10n.getString(
        supportsFirefoxExtension()
          ? "multi-part-onboarding-premium-extension-get-title"
          : "multi-part-onboarding-premium-chrome-extension-get-title"
      )}
    </h2>
  );
};

interface AddonDescriptionProps {
  headerMessageId: string;
  paragraphMessageId: string;
  linkHref: string;
  linkMessageId: string;
}
const getAddonDescriptionProps = () => {
  if (supportsFirefoxExtension()) {
    return {
      headerMessageId: "multi-part-onboarding-premium-extension-get-title",
      paragraphMessageId:
        "multi-part-onboarding-premium-extension-get-description-2",
      linkHref:
        "https://addons.mozilla.org/firefox/addon/private-relay/?utm_source=fx-relay&utm_medium=onboarding&utm_campaign=install-addon",
      linkMessageId: "multi-part-onboarding-premium-extension-button-download",
    };
  }
  if (supportsChromeExtension()) {
    return {
      headerMessageId:
        "multi-part-onboarding-premium-chrome-extension-get-title",
      paragraphMessageId:
        "multi-part-onboarding-premium-chrome-extension-get-description-2",
      linkHref:
        "https://chrome.google.com/webstore/detail/firefox-relay/lknpoadjjkjcmjhbjpcljdednccbldeb?utm_source=fx-relay&utm_medium=onboarding&utm_campaign=install-addon",
      linkMessageId:
        "multi-part-onboarding-premium-chrome-extension-button-download",
    };
  }
  return {
    headerMessageId: "",
    paragraphMessageId: "",
    linkHref: "",
    linkMessageId: "",
  };
};

const AddonDescription = () => {
  const isLargeScreen = useMinViewportWidth("md");
  const { headerMessageId, paragraphMessageId, linkHref, linkMessageId } =
    getAddonDescriptionProps();
  if (!isLargeScreen) {
    return null;
  }
  if (supportsAnExtension()) {
    return (
      <div className={`${styles["addon-description"]} is-hidden-with-addon`}>
        <AddonDescriptionHeader headerMessageId={headerMessageId} />
        <AddonDescriptionParagraph paragraphMessageId={paragraphMessageId} />
        <AddonDescriptionLinkButton
          linkHref={linkHref}
          linkMessageId={linkMessageId}
        />
      </div>
    );
  }
  return null;
};

const AddonDescriptionHeader = ({
  headerMessageId,
}: Pick<AddonDescriptionProps, "headerMessageId">) => {
  const { l10n } = useLocalization();
  if (!supportsAnExtension()) {
    return null;
  }
  return <h3>{l10n.getString(headerMessageId)}</h3>;
};

const AddonDescriptionParagraph = ({
  paragraphMessageId,
}: Pick<AddonDescriptionProps, "paragraphMessageId">) => {
  const { l10n } = useLocalization();
  if (!supportsAnExtension()) {
    return null;
  }
  return <p>{l10n.getString(paragraphMessageId)}</p>;
};

const AddonDescriptionLinkButton = ({
  linkHref,
  linkMessageId,
}: Pick<AddonDescriptionProps, "linkHref" | "linkMessageId">) => {
  const { l10n } = useLocalization();
  if (!supportsAnExtension()) {
    return null;
  }
  return (
    <LinkButton
      href={linkHref}
      target="_blank"
      className={styles["get-addon-button"]}
    >
      {l10n.getString(linkMessageId)}
    </LinkButton>
  );
};

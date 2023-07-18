import { useState } from "react";
import { event as gaEvent } from "react-ga";
import { useOverlayTriggerState } from "react-stately";
import Image from "next/image";
import styles from "./PremiumOnboarding.module.scss";
import ManLaptopEmail from "./images/man-laptop-email-alt.svg";
import WomanOnCouch from "./images/woman-couch.svg";
import WomanEmail from "./images/woman-email.svg";
import { Button, LinkButton } from "../Button";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { ProfileData } from "../../hooks/api/profile";
import { SubdomainSearchForm } from "./subdomain/SearchForm";
import { SubdomainConfirmationModal } from "./subdomain/ConfirmationModal";
import { getRuntimeConfig } from "../../config";
import { useMinViewportWidth } from "../../hooks/mediaQuery";
import { supportsChromeExtension } from "../../functions/userAgent";
import { CheckBadgeIcon, CheckIcon } from "../Icons";
import { useL10n } from "../../hooks/l10n";
import { VisuallyHidden } from "../VisuallyHidden";
import { Localized } from "../Localized";

export type Props = {
  profile: ProfileData;
  onNextStep: (step: number) => void;
  onPickSubdomain: (subdomain: string) => void;
};

/**
 * Shows the user how to take advantage of Premium features when they've just upgraded.
 */
export const PremiumOnboarding = (props: Props) => {
  const l10n = useL10n();
  const isLargeScreen = useMinViewportWidth("md");

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

  let step = null;
  let button = null;
  let skipButton = null;

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
        {l10n.getString("multi-part-onboarding-premium-welcome-feature-cta")}
      </Button>
    );
  }

  if (props.profile.onboarding_state === 1) {
    step = (
      <StepTwo
        onNextStep={props.onNextStep}
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

      skipButton = (
        <button
          ref={skipDomainButtonRef}
          onClick={skipDomain}
          className={styles["skip-link"]}
        >
          {l10n.getString("multi-part-onboarding-skip")}
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
          {l10n.getString("multi-part-onboarding-continue")}
        </Button>
      );
    }
  }

  if (props.profile.onboarding_state === 2) {
    step = <StepThree />;
    const { linkHref, linkMessageId } = getAddonDescriptionProps();

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
          className={`${styles["go-to-dashboard-button"]} ${
            isLargeScreen ? `is-visible-with-addon` : ""
          }`}
        >
          {l10n.getString(
            "multi-part-onboarding-premium-extension-button-dashboard",
          )}
        </Button>
        <AddonDescriptionLinkButton
          linkHref={linkHref}
          linkMessageId={linkMessageId}
        />
      </>
    );

    skipButton = isLargeScreen ? (
      <button
        className={`${styles["skip-link"]} is-hidden-with-addon`}
        ref={skipAddonButtonRef}
        onClick={skipAddon}
      >
        {l10n.getString("multi-part-onboarding-skip-download-extension")}
      </button>
    ) : null;
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

          {skipButton}
        </div>
      </section>
    </>
  );
};

const StepOne = () => {
  const l10n = useL10n();

  type FeatureItemProps = {
    name: string;
  };

  const FeatureItem = (props: FeatureItemProps) => {
    return (
      <li>
        <CheckIcon alt={""} className={styles["check-icon"]} />
        <p>
          <strong>
            {l10n.getString(
              `multi-part-onboarding-premium-welcome-feature-headline-${props.name}`,
            )}
          </strong>
          <br />
          <span>
            {l10n.getString(
              `multi-part-onboarding-premium-welcome-feature-body-${props.name}`,
            )}
          </span>
        </p>
      </li>
    );
  };

  return (
    <div className={`${styles.step} ${styles["step-welcome"]}`}>
      <div className={styles["title-container"]}>
        <h2>
          {l10n.getString("multi-part-onboarding-premium-welcome-headline")}
        </h2>
        <p className={styles.lead}>
          {l10n.getString(
            "multi-part-onboarding-premium-welcome-subheadline-2",
          )}
        </p>
      </div>
      <div className={styles.description}>
        <Image src={WomanOnCouch} alt="" width={350} />
        <div>
          <span className={styles["description-caption"]}>
            {l10n.getString(
              "multi-part-onboarding-premium-welcome-feature-headline",
            )}
          </span>
          <br />
          <ul className={styles["feature-item-list"]}>
            <FeatureItem name={"unlimited-email-masks"} />
            <FeatureItem name={"create-masks-on-the-go"} />
            <FeatureItem name={"custom-inbox-controls"} />
            <FeatureItem name={"anonymous-replies"} />
          </ul>
        </div>
      </div>
    </div>
  );
};

type Step2Props = {
  profile: ProfileData;
  onPickSubdomain: (subdomain: string) => void;
  onNextStep: (step: number) => void;
};
const StepTwo = (props: Step2Props) => {
  const l10n = useL10n();
  const [showSubdomainConfirmation, setShowSubdomainConfirmation] =
    useState(false);

  const [chosenSubdomain, setChosenSubdomain] = useState("");
  const [partialSubdomain, setPartialSubdomain] = useState("");

  const modalState = useOverlayTriggerState({});

  const onPick = (subdomain: string) => {
    setChosenSubdomain(subdomain);
    modalState.open();
  };

  const onConfirm = () => {
    props.onPickSubdomain(chosenSubdomain);
    setShowSubdomainConfirmation(true);
  };

  const onType = (_partial: string) => {
    setPartialSubdomain(_partial);
  };

  // Opens the confirmation and success modal
  const dialog = modalState.isOpen ? (
    <SubdomainConfirmationModal
      subdomain={chosenSubdomain}
      isOpen={modalState.isOpen}
      isSet={typeof props.profile.subdomain === "string"}
      onClose={() => modalState.close()}
      onConfirm={onConfirm}
      onComplete={() => modalState.close()}
    />
  ) : null;

  // Switches between the custom domain search and display module
  const subdomain = showSubdomainConfirmation ? (
    <p className={styles["action-complete"]}>
      <span className={styles.label}>
        <CheckBadgeIcon alt="" width={18} height={18} />
        {l10n.getString("multi-part-onboarding-premium-email-domain-added")}
      </span>
      <div>@{props.profile.subdomain}</div>
      <span className={styles.domain}>.{getRuntimeConfig().mozmailDomain}</span>
    </p>
  ) : (
    <>
      <div className={styles["domain-example"]}>
        ***@
        <span className={styles["customizable-part"]}>
          {partialSubdomain !== ""
            ? partialSubdomain
            : l10n.getString(
                "multi-part-onboarding-premium-email-domain-placeholder",
              )}
        </span>
        .{getRuntimeConfig().mozmailDomain}
      </div>
      <SubdomainSearchForm onType={onType} onPick={onPick} />
    </>
  );

  return (
    <div className={`${styles.step} ${styles["step-custom-domain"]}`}>
      <div className={styles["title-container"]}>
        <h2>
          {l10n.getString(
            "multi-part-onboarding-premium-email-domain-headline",
          )}
        </h2>
      </div>
      <div className={styles.description}>
        <Image src={WomanEmail} alt="" width={400} />
        <div className={styles.content}>
          <p className={styles["subdomain-description"]}>
            <span className={styles["description-caption"]}>
              {l10n.getString(
                "multi-part-onboarding-premium-email-domain-feature-headline",
              )}
            </span>
            <span className={styles["description-bolded-headline"]}>
              {l10n.getString(
                "multi-part-onboarding-premium-email-domain-headline-create-masks-on-the-go",
              )}
            </span>
            <br />
            {!showSubdomainConfirmation ? (
              <Localized
                id="multi-part-onboarding-premium-email-domain-feature-body"
                vars={{ mozmail: "mozmail.com" }}
                elems={{
                  p: <p />,
                }}
              >
                <span />
              </Localized>
            ) : null}
          </p>
          {subdomain}
          {dialog}
        </div>
      </div>
    </div>
  );
};

const StepThree = () => {
  const l10n = useL10n();

  return (
    <div className={`${styles.step} ${styles["step-addon"]}`}>
      <div className={styles["title-container"]}>
        <StepThreeTitle />
      </div>
      <div className={styles.description}>
        <Image src={ManLaptopEmail} alt="" width={500} />
        <div>
          <p className={styles["reply-description"]}>
            <span className={styles["description-caption"]}>
              {l10n.getString("onboarding-premium-title-detail")}
            </span>
            <br />
            <span className={styles["description-bolded-headline"]}>
              {l10n.getString(
                "multi-part-onboarding-premium-reply-description",
              )}
            </span>
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
            <p className={`${styles["addon-description"]}`}>
              {l10n.getString(
                "multi-part-onboarding-premium-added-extension-body",
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const StepThreeTitle = () => {
  const l10n = useL10n();
  const isLargeScreen = useMinViewportWidth("md");
  const stepThreeTitleString = isLargeScreen
    ? l10n.getString("multi-part-onboarding-premium-add-extension-headline")
    : l10n.getString("multi-part-onboarding-reply-headline");

  return <h2>{stepThreeTitleString}</h2>;
};

interface AddonDescriptionProps {
  headerMessageId: string;
  paragraphMessageId: string;
  linkHref: string;
  linkMessageId: string;
}
const getAddonDescriptionProps = () => {
  const linkForBrowser = supportsChromeExtension()
    ? "https://chrome.google.com/webstore/detail/firefox-relay/lknpoadjjkjcmjhbjpcljdednccbldeb?utm_source=fx-relay&utm_medium=onboarding&utm_campaign=install-addon"
    : "https://addons.mozilla.org/en-CA/firefox/addon/private-relay/";

  return {
    headerMessageId:
      "multi-part-onboarding-premium-add-extension-feature-headline-create-any-site",
    paragraphMessageId:
      "multi-part-onboarding-premium-add-extension-feature-body",
    linkHref: linkForBrowser,
    linkMessageId: "multi-part-onboarding-premium-add-extension-feature-cta",
  };
};

const AddonDescription = () => {
  const l10n = useL10n();

  const isLargeScreen = useMinViewportWidth("md");
  const { headerMessageId, paragraphMessageId } = getAddonDescriptionProps();
  if (!isLargeScreen) {
    return null;
  }
  return (
    <>
      <div className={`${styles["addon-description"]} is-hidden-with-addon`}>
        <span className={styles["description-caption"]}>
          {l10n.getString(
            "multi-part-onboarding-premium-add-extension-feature-headline",
          )}
        </span>
        <AddonDescriptionHeader headerMessageId={headerMessageId} />
        <AddonDescriptionParagraph paragraphMessageId={paragraphMessageId} />
      </div>
    </>
  );
};

const AddonDescriptionHeader = ({
  headerMessageId,
}: Pick<AddonDescriptionProps, "headerMessageId">) => {
  const l10n = useL10n();
  return <h3>{l10n.getString(headerMessageId)}</h3>;
};

const AddonDescriptionParagraph = ({
  paragraphMessageId,
}: Pick<AddonDescriptionProps, "paragraphMessageId">) => {
  const l10n = useL10n();
  return <p>{l10n.getString(paragraphMessageId)}</p>;
};

const AddonDescriptionLinkButton = ({
  linkHref,
  linkMessageId,
}: Pick<AddonDescriptionProps, "linkHref" | "linkMessageId">) => {
  const l10n = useL10n();
  return (
    <LinkButton
      href={linkHref}
      target="_blank"
      className={`is-hidden-with-addon ${styles["get-addon-button"]}`}
    >
      {l10n.getString(linkMessageId)}
    </LinkButton>
  );
};

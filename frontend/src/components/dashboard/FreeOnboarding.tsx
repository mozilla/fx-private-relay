import styles from "./FreeOnboarding.module.scss";
import { ProfileData } from "../../hooks/api/profile";
import { VisuallyHidden } from "../VisuallyHidden";
import { getRuntimeConfig } from "../../config";
import { useL10n } from "../../hooks/l10n";
import WomanEmail from "./images/woman-email.svg";
import CheckMark from "./images/welcome-to-relay-check.svg";
import Plus from "./images/welcome-to-relay-plus.svg";
import Congratulations from "./images/free-onboarding-congratulations.svg";
import VerticalArrow from "./images/free-onboarding-vertical-arrow.svg";
import Emails from "./images/free-onboarding-emails.svg";
import WorkingMan from "./images/free-onboarding-work-anywhere.svg";
import Extension from "./images/free-onboarding-relay-extension.svg";
import SmallArrow from "./images/free-onboarding-arrow.svg";
import LargeArrow from "./images/free-onboarding-arrow-large.svg";
import Image from "next/image";
import { Button, LinkButton } from "../Button";
import { event as gaEvent } from "react-ga";
import { useGaViewPing } from "../../hooks/gaViewPing";
import { AliasData } from "../../hooks/api/aliases";
import { UserData } from "../../hooks/api/user";
import { RuntimeData } from "../../hooks/api/runtimeData";
import { EmailForwardingModal } from "./EmailForwardingModal";
import { useState } from "react";
import { supportsChromeExtension } from "../../functions/userAgent";
import { CheckBadgeIcon, ChevronRightIcon } from "../Icons";
import { AliasList } from "./aliases/AliasList";

export type Props = {
  profile: ProfileData;
  onNextStep: (step: number) => void;
  onPickSubdomain: (subdomain: string) => void;
  generateNewMask: () => void;
  hasReachedFreeMaskLimit: boolean;
  aliases: AliasData[];
  user: UserData;
  runtimeData?: RuntimeData;
  onUpdate: (alias: AliasData, updatedFields: Partial<AliasData>) => void;
};

/**
 * Shows the user how to take advantage of Premium features when they've just upgraded.
 */
export const FreeOnboarding = (props: Props) => {
  const l10n = useL10n();
  const [isModalOpen, setIsModalOpen] = useState(false);

  let step = null;
  let button = null;
  let skipButton = null;
  let next = null;

  // TODO: Add GA events - for view events and pings
  const skipStepOneButtonRef = useGaViewPing({
    category: "Free Onboarding",
    label: "free-onboarding-step-1-skip",
    value: 1,
  });

  const skipStepTwoButtonRef = useGaViewPing({
    category: "Free Onboarding",
    label: "free-onboarding-step-2-skip",
    value: 1,
  });

  const nextStepTwoButtonRef = useGaViewPing({
    category: "Free Onboarding",
    label: "free-onboarding-step-2-next",
    value: 1,
  });

  const skipStepThreeButtonRef = useGaViewPing({
    category: "Free Onboarding",
    label: "free-onboarding-step-3-skip",
    value: 1,
  });

  if (props.profile.onboarding_free_state === 0) {
    const skipMaskCreation = () => {
      props.onNextStep(3);
      gaEvent({
        category: "Free Onboarding",
        action: "Engage",
        label: "onboarding-step-1-skip",
        value: 1,
      });
    };

    const createNewMask = () => {
      props.generateNewMask();
      props.onNextStep(1);
      gaEvent({
        category: "Free Onboarding",
        action: "Engage",
        label: "onboarding-step-1-create-random-mask",
        value: 1,
      });
    };

    step = <StepOne />;

    skipButton = (
      <button
        ref={skipStepOneButtonRef}
        className={styles["skip-link"]}
        onClick={skipMaskCreation}
      >
        {l10n.getString("profile-free-onboarding--skip-step")}
      </button>
    );

    button = (
      <Button className={styles["generate-new-mask"]} onClick={createNewMask}>
        {l10n.getString("profile-free-onboarding--welcome-generate-new-mask")}
        <Image src={Plus} alt="" />
      </Button>
    );
  }

  if (props.profile.onboarding_free_state === 1) {
    const skipMaskTesting = () => {
      props.onNextStep(3);
      gaEvent({
        category: "Free Onboarding",
        action: "Engage",
        label: "onboarding-step-2-skip",
        value: 1,
      });
    };

    const nextStep = () => {
      props.onNextStep(2);
      gaEvent({
        category: "Free Onboarding",
        action: "Engage",
        label: "onboarding-step-2-next",
        value: 1,
      });
    };

    const forwardedEmail = () => {
      props.onNextStep(2);
      gaEvent({
        category: "Free Onboarding",
        action: "Engage",
        label: "onboarding-step-2-continue",
        value: 1,
      });
    };

    step = (
      <StepTwo
        aliases={props.aliases}
        profile={props.profile}
        user={props.user}
        runtimeData={props.runtimeData}
        continue={forwardedEmail}
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        onUpdate={props.onUpdate}
      />
    );

    next = (
      <button
        ref={nextStepTwoButtonRef}
        className={styles["next-link"]}
        onClick={nextStep}
      >
        {l10n.getString("profile-free-onboarding--next-step")}
        <ChevronRightIcon className={styles.chevron} width={16} alt="" />
      </button>
    );

    button = (
      <Button
        className={styles["generate-new-mask"]}
        onClick={() => {
          setIsModalOpen(true);
        }}
      >
        {l10n.getString(
          "profile-free-onboarding--copy-mask-how-forwarding-works",
        )}
        <Image src={Plus} alt="" />
      </Button>
    );

    skipButton = (
      <button
        ref={skipStepTwoButtonRef}
        className={styles["skip-link"]}
        onClick={skipMaskTesting}
      >
        {l10n.getString("profile-free-onboarding--skip-step")}
      </button>
    );
  }

  if (props.profile.onboarding_free_state === 2) {
    const linkForBrowser = supportsChromeExtension()
      ? "https://chrome.google.com/webstore/detail/firefox-relay/lknpoadjjkjcmjhbjpcljdednccbldeb?utm_source=fx-relay&utm_medium=onboarding&utm_campaign=install-addon"
      : "https://addons.mozilla.org/firefox/addon/private-relay/";

    const skipAddonStep = () => {
      props.onNextStep(3);
      gaEvent({
        category: "Free Onboarding",
        action: "Engage",
        label: "onboarding-step-3-skip",
        value: 1,
      });
    };

    const finish = () => {
      props.onNextStep(3);
      gaEvent({
        category: "Free Onboarding",
        action: "Engage",
        label: "onboarding-step-3-complete",
        value: 1,
      });
    };

    step = <StepThree />;

    next = (
      <button
        ref={nextStepTwoButtonRef}
        className={styles["next-link"]}
        onClick={finish}
      >
        {l10n.getString("profile-free-onboarding--addon-finish")}
        <ChevronRightIcon className={styles.chevron} width={16} alt="" />
      </button>
    );

    button = (
      <>
        <LinkButton
          href={linkForBrowser}
          target="_blank"
          className={`is-hidden-with-addon ${styles["get-addon-button"]}`}
        >
          {l10n.getString("profile-free-onboarding--addon-get-extension")}
        </LinkButton>
        <div className={`${styles["addon-description"]} is-visible-with-addon`}>
          <div className={styles["action-complete"]}>
            <CheckBadgeIcon alt="" width={18} height={18} />
            {l10n.getString("multi-part-onboarding-premium-extension-added")}
          </div>
        </div>
      </>
    );

    skipButton = (
      <button
        ref={skipStepThreeButtonRef}
        className={styles["skip-link"]}
        onClick={skipAddonStep}
      >
        {l10n.getString("profile-free-onboarding--skip-step")}
      </button>
    );
  }

  return (
    <section className={styles.onboarding}>
      {step}
      <div className={styles.controls}>
        {button}
        <div className={styles["progress-container"]}>
          <VisuallyHidden>
            <progress
              max={getRuntimeConfig().maxOnboardingAvailable}
              value={props.profile.onboarding_free_state + 1}
            >
              {l10n.getString("multi-part-onboarding-step-counter", {
                step: props.profile.onboarding_free_state,
                max: getRuntimeConfig().maxOnboardingAvailable,
              })}
            </progress>
          </VisuallyHidden>
          {next}
          <ol className={styles["styled-progress-bar"]} aria-hidden={true}>
            <li
              className={
                props.profile.onboarding_free_state >= 0
                  ? styles["is-completed"]
                  : undefined
              }
            >
              <span></span>1
            </li>
            <li
              className={
                props.profile.onboarding_free_state >= 1
                  ? styles["is-completed"]
                  : undefined
              }
            >
              <span></span>2
            </li>
            <li
              className={
                props.profile.onboarding_free_state >= 2
                  ? styles["is-completed"]
                  : undefined
              }
            >
              <span></span>3
            </li>
          </ol>
        </div>
        {skipButton}
      </div>
    </section>
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
            <Image className={styles["hidden-mobile"]} src={CheckMark} alt="" />
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

type StepTwoProps = {
  aliases: AliasData[];
  profile: ProfileData;
  user: UserData;
  runtimeData?: RuntimeData;
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  continue: () => void;
  onUpdate: (alias: AliasData, updatedFields: Partial<AliasData>) => void;
};

const StepTwo = (props: StepTwoProps) => {
  const l10n = useL10n();
  const [isSet, setIsSet] = useState(false);

  return (
    <div className={`${styles.step} ${styles["step-copy-mask"]}`}>
      <EmailForwardingModal
        isOpen={props.isModalOpen}
        onClose={() => {
          props.setIsModalOpen(false);
        }}
        onComplete={() => {
          props.setIsModalOpen(false);
          props.continue();
        }}
        onConfirm={() => {
          setIsSet(true);
        }}
        isSet={isSet}
      />
      <div className={styles["copy-mask-header"]}>
        <h1>{l10n.getString("profile-free-onboarding--copy-mask-headline")}</h1>
        <p>
          {l10n.getString("profile-free-onboarding--copy-mask-description")}
        </p>
      </div>
      <div className={styles["content-wrapper-copy-mask"]}>
        <div className={styles["copy-mask-arrow-element"]}>
          <Image src={VerticalArrow} alt="" />
        </div>
        <AliasList
          aliases={props.aliases}
          onCreate={() => {}}
          onUpdate={props.onUpdate}
          onDelete={() => {}}
          profile={props.profile}
          user={props.user}
          runtimeData={props.runtimeData}
          onboarding={true}
        >
          <div className={styles["content-wrapper-copy-mask-items"]}>
            <div className={styles["content-item"]}>
              <Image src={Emails} alt="" />
              <div className={styles["content-text"]}>
                <p className={styles["headline"]}>
                  {l10n.getString(
                    "profile-free-onboarding--copy-mask-item-headline-1",
                  )}
                </p>
                <p className={styles["description"]}>
                  {l10n.getString(
                    "profile-free-onboarding--copy-mask-item-description-1",
                  )}
                </p>
              </div>
            </div>
            <hr />
            <div className={styles["content-item"]}>
              <Image src={Congratulations} alt="" />
              <div className={styles["content-text"]}>
                <p className={styles["headline"]}>
                  {l10n.getString(
                    "profile-free-onboarding--copy-mask-item-headline-2",
                  )}
                </p>
                <p className={styles["description"]}>
                  {l10n.getString(
                    "profile-free-onboarding--copy-mask-item-description-2",
                  )}
                </p>
              </div>
            </div>
          </div>
        </AliasList>
      </div>
    </div>
  );
};

const StepThree = () => {
  const l10n = useL10n();

  return (
    <div
      className={`${styles.step} ${styles["step-copy-mask"]} ${styles["mask-use"]}`}
    >
      <div className={styles["copy-mask-header"]}>
        <h1>{l10n.getString("profile-free-onboarding--addon-headline")}</h1>
        <p>{l10n.getString("profile-free-onboarding--addon-subheadline")}</p>
      </div>
      <div className={styles["addon-content-wrapper"]}>
        <div className={styles["addon-content-items"]}>
          <div className={styles["addon-content-text"]}>
            <p className={styles.headline}>
              {l10n.getString("profile-free-onboarding--addon-item-headline-1")}
            </p>
            <p className={styles.description}>
              {l10n.getString(
                "profile-free-onboarding--addon-item-description-1",
              )}
            </p>
            <Image className={styles["large-arrow"]} src={LargeArrow} alt="" />
          </div>
          <Image src={WorkingMan} alt="" />
        </div>

        <div className={styles["addon-content-items"]}>
          <Image src={Extension} alt="" />
          <div className={styles["addon-content-text"]}>
            <p className={styles.headline}>
              {l10n.getString("profile-free-onboarding--addon-item-headline-2")}
            </p>
            <p className={styles.description}>
              {l10n.getString(
                "profile-free-onboarding--addon-item-description-2",
              )}
            </p>
            <Image className={styles["small-arrow"]} src={SmallArrow} alt="" />
          </div>
        </div>
      </div>
    </div>
  );
};
